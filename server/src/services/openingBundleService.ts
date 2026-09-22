import tracer from "dd-trace";
import { logEvent } from "./logger.js";
import { get as s3Get, put as s3Put } from "./mediaCache.js";
import { generateMultiVoiceTTS } from "./tts.js";
import { PHRASE_BANK } from "@dnd-adventures/shared-types";
import type { Phrase } from "@dnd-adventures/shared-types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpeningBundle {
  phraseId: string;
  display: string;
  text: string;
  voice: string;
  mood: string;
  model: string;
  generatedAt: string;
  audioBuffer: Buffer;
}

interface BundleManifest {
  phraseId: string;
  display: string;
  text: string;
  voice: string;
  mood: string;
  model: string;
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const S3_PREFIX = "openings/v1";
const OPENING_PHRASES = PHRASE_BANK.filter((p) => p.id.startsWith("opening_"));

function metadataKey(phraseId: string): string {
  return `${S3_PREFIX}/${phraseId}.json`;
}

function audioKey(phraseId: string): string {
  return `${S3_PREFIX}/${phraseId}.mp3`;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const bundleCache = new Map<string, OpeningBundle>();
const generatingSet = new Set<string>();

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Return a random ready bundle from in-memory cache, or null if none loaded yet.
 */
export function getRandomBundle(): OpeningBundle | null {
  if (bundleCache.size === 0) return null;
  const bundles = Array.from(bundleCache.values());
  return bundles[Math.floor(Math.random() * bundles.length)];
}

/**
 * Load existing bundles from S3 and generate any missing ones in the background.
 * Does not block — missing bundles are generated fire-and-forget.
 */
export async function ensureOpeningBundles(): Promise<void> {
  logEvent("info", "openings.ensure_started", {
    phraseCount: OPENING_PHRASES.length,
  });

  // Attempt to load all 3 bundles from S3 in parallel
  const loadResults = await Promise.allSettled(
    OPENING_PHRASES.map((phrase) => loadBundleFromS3(phrase)),
  );

  // Store loaded bundles, collect missing ones
  const missing: Phrase[] = [];
  for (let i = 0; i < OPENING_PHRASES.length; i++) {
    const result = loadResults[i];
    const phrase = OPENING_PHRASES[i];
    if (result.status === "fulfilled" && result.value) {
      bundleCache.set(phrase.id, result.value);
      logEvent("info", "openings.s3_bundle_loaded", { phraseId: phrase.id });
    } else {
      missing.push(phrase);
      logEvent("info", "openings.s3_bundle_missing", { phraseId: phrase.id });
    }
  }

  logEvent("info", "openings.ensure_load_complete", {
    loaded: bundleCache.size,
    missing: missing.length,
  });

  // Generate missing bundles in the background (fire-and-forget)
  for (const phrase of missing) {
    void generateAndStoreBundleBackground(phrase);
  }
}

/**
 * Stats for health/observability endpoints.
 */
export function getOpeningBundleStats() {
  return {
    cached: bundleCache.size,
    total: OPENING_PHRASES.length,
    generating: generatingSet.size,
    phraseIds: OPENING_PHRASES.map((p) => ({
      id: p.id,
      cached: bundleCache.has(p.id),
      generating: generatingSet.has(p.id),
    })),
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function loadBundleFromS3(phrase: Phrase): Promise<OpeningBundle | null> {
  const [jsonBuf, audioBuf] = await Promise.all([
    s3Get(metadataKey(phrase.id)),
    s3Get(audioKey(phrase.id)),
  ]);

  if (!jsonBuf || !audioBuf) return null;

  try {
    const manifest = JSON.parse(jsonBuf.toString("utf-8")) as BundleManifest;
    return {
      ...manifest,
      audioBuffer: audioBuf,
    };
  } catch {
    logEvent("warn", "openings.manifest_parse_failed", { phraseId: phrase.id });
    return null;
  }
}

async function generateAndStoreBundleBackground(phrase: Phrase): Promise<void> {
  if (generatingSet.has(phrase.id)) return;
  generatingSet.add(phrase.id);

  logEvent("info", "openings.generation_started", { phraseId: phrase.id });
  const startMs = Date.now();

  try {
    const model = phrase.models[0] ?? "speech-2.8-hd";
    const mood = phrase.moods[0] ?? "tavern";

    const { audioBuffer } = await generateMultiVoiceTTS(phrase.text, { model, mood });

    const manifest: BundleManifest = {
      phraseId: phrase.id,
      display: phrase.display,
      text: phrase.text,
      voice: phrase.voice,
      mood,
      model,
      generatedAt: new Date().toISOString(),
    };

    // Write both files to S3 together
    await Promise.all([
      s3Put(metadataKey(phrase.id), Buffer.from(JSON.stringify(manifest)), "application/json"),
      s3Put(audioKey(phrase.id), audioBuffer, "audio/mpeg"),
    ]);

    // Store in memory
    const bundle: OpeningBundle = { ...manifest, audioBuffer };
    bundleCache.set(phrase.id, bundle);

    const durationMs = Date.now() - startMs;
    tracer.dogstatsd.increment("openings.bundle_generated", 1, { phrase_id: phrase.id });

    logEvent("info", "openings.generation_completed", {
      phraseId: phrase.id,
      durationMs,
      audioSizeBytes: audioBuffer.length,
    });
  } catch (err) {
    logEvent("error", "openings.generation_failed", {
      phraseId: phrase.id,
      durationMs: Date.now() - startMs,
    }, err);
  } finally {
    generatingSet.delete(phrase.id);
  }
}
