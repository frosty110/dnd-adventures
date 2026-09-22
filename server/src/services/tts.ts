import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import tracer from "dd-trace";
import { config } from "./config.js";
import { logEvent } from "./logger.js";
import { buildKey, get as s3Get, put as s3Put } from "./mediaCache.js";
import {
  type SceneMood,
  type SceneId,
  type CharacterVoice,
  VALID_SCENES,
  VALID_MOODS,
  extractMood,
  extractScene,
  extractEmotion,
  splitVoiceSegments,
  stripTTSTags,
  sanitizeForTTS,
  expandPhrases,
} from "@dnd-adventures/shared-types";

export type { SceneMood, SceneId, CharacterVoice };
export { extractMood, extractScene, splitVoiceSegments, stripTTSTags, sanitizeForTTS, expandPhrases };

export type TTSModel = "speech-2.8-hd" | "speech-2.8-turbo";

export interface TTSOptions {
  model?: TTSModel;         // default "speech-2.8-hd"
  mood?: SceneMood;         // affects speed/pitch
  voice?: CharacterVoice;   // affects voice_id
  stream?: boolean;         // default false
}

export interface TTSResult {
  audioBuffer: Buffer;
  audioFormat: string;
  durationMs: number;
}

const VOICE_MAP: Record<CharacterVoice, string> = {
  narrator: "English_CaptivatingStoryteller",
  barkeep: "English_Debator",                 // Gorm: tough, middle-aged, assertive ex-soldier
  goblin: "English_Comedian",                 // chaotic, quirky goblin energy
};

const MOOD_PROSODY: Record<SceneMood, { speed: number; pitch: number }> = {
  combat:      { speed: 1.15, pitch: 2 },
  exploration: { speed: 0.85, pitch: -2 },
  tavern:      { speed: 0.9,  pitch: -1 },
  mystery:     { speed: 0.80, pitch: -3 },
  dramatic:    { speed: 1.0,  pitch: 1 },
  danger:      { speed: 1.05, pitch: 0 },
};

// ── TTS audio cache ──────────────────────────────────────────────────────────
// Key = hash of (text + voice + mood + model). Avoids duplicate MiniMax calls.

interface TTSCacheEntry {
  result: TTSResult;
  createdAt: number;
}

const TTS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const ttsCache = new LRUCache<string, TTSCacheEntry>({
  maxSize: 100 * 1024 * 1024, // 100MB byte budget
  sizeCalculation: (entry) => entry.result.audioBuffer.byteLength,
  ttl: TTS_CACHE_TTL_MS,
  allowStale: false,
});

let ttsCacheHits = 0;
let ttsCacheMisses = 0;

function buildTTSCacheKey(text: string, voice: CharacterVoice, mood: SceneMood | undefined, model: TTSModel, emotion?: string): string {
  return `${model}|${voice}|${mood ?? "none"}|${emotion ?? "auto"}|${text}`;
}

function hashKey(preHashKey: string): string {
  return createHash("sha256").update(preHashKey).digest("hex").slice(0, 16);
}

export function getTTSCacheStats() {
  return {
    hits: ttsCacheHits,
    misses: ttsCacheMisses,
    size: ttsCache.size,
    byteSize: ttsCache.calculatedSize,
  };
}

export async function generateTTS(text: string, options: TTSOptions = {}): Promise<TTSResult> {
  // Extract {{emotion:TAG}} — passed directly to MiniMax voice_setting.emotion
  const [emotion, textWithoutEmotion] = extractEmotion(text);
  // Strip markdown so MiniMax doesn't read formatting aloud
  const cleanText = sanitizeForTTS(textWithoutEmotion);
  const model = options.model ?? "speech-2.8-hd";
  const voice = options.voice ?? "narrator";
  const prosody = options.mood ? MOOD_PROSODY[options.mood] : { speed: 1, pitch: 0 };

  // ── Cache lookup (keyed on cleaned text) ───────────────────────────────
  const preHashKey = buildTTSCacheKey(cleanText, voice, options.mood, model, emotion ?? undefined);
  const cacheKey = hashKey(preHashKey);
  const s3Key = buildKey("tts/v1", `${model}|${voice}|${options.mood ?? "none"}|${emotion ?? "auto"}|${cleanText}`, "mp3");

  // L1: in-memory LRU cache (zero latency for recently generated audio)
  const l1Cached = ttsCache.get(cacheKey);
  if (l1Cached) {
    ttsCacheHits++;
    tracer.dogstatsd.increment('cache.hit', 1, { cache_type: 'tts', source: 'memory' });
    logEvent("info", "tts.cache_hit", {
      cacheKey,
      s3Key,
      source: "memory",
      preHashKey: preHashKey.slice(0, 120),
      textLength: cleanText.length,
      voice,
      mood: options.mood ?? "none",
      model,
      cacheHits: ttsCacheHits,
      cacheMisses: ttsCacheMisses,
      cacheSize: ttsCache.size,
    });
    return l1Cached.result;
  }

  // L2: S3 (durable, cross-instance cache)
  let s3Buffer: Buffer | null = null;
  try {
    s3Buffer = await s3Get(s3Key);
  } catch (err) {
    // S3 unavailable — degrade gracefully, treat as miss
    logEvent("warn", "tts.s3_cache_get_failed", { s3Key, error: String(err) });
  }

  if (s3Buffer) {
    ttsCacheHits++;
    tracer.dogstatsd.increment('cache.hit', 1, { cache_type: 'tts', source: 's3' });
    const s3Result: TTSResult = { audioBuffer: s3Buffer, audioFormat: "mp3", durationMs: 0 };
    // Promote to L1 for zero-latency access on subsequent requests in this session
    ttsCache.set(cacheKey, { result: s3Result, createdAt: Date.now() });
    logEvent("info", "tts.cache_hit", {
      cacheKey,
      s3Key,
      source: "s3",
      preHashKey: preHashKey.slice(0, 120),
      textLength: cleanText.length,
      voice,
      mood: options.mood ?? "none",
      model,
      cacheHits: ttsCacheHits,
      cacheMisses: ttsCacheMisses,
      cacheSize: ttsCache.size,
    });
    return s3Result;
  }

  ttsCacheMisses++;
  tracer.dogstatsd.increment('cache.miss', 1, { cache_type: 'tts' });
  logEvent("info", "tts.cache_miss", {
    cacheKey,
    s3Key,
    preHashKey: preHashKey.slice(0, 120),
    textLength: cleanText.length,
    voice,
    mood: options.mood ?? "none",
    model,
    cacheHits: ttsCacheHits,
    cacheMisses: ttsCacheMisses,
    cacheSize: ttsCache.size,
    reason: "not_found",
  });

  // ── API call (cache miss) ─────────────────────────────────────────────
  return tracer.llmobs.trace(
    { kind: "tool", name: "minimax.tts" },
    async (span) => {
      const url = `https://api.minimax.io/v1/t2a_v2?GroupId=${config.MINIMAX_GROUP_ID}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.MINIMAX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          text: cleanText,
          stream: false,
          output_format: "hex",
          voice_setting: {
            voice_id: VOICE_MAP[voice],
            speed: prosody.speed,
            vol: 1,
            pitch: prosody.pitch,
            ...(emotion && { emotion: emotion }),
          },
          audio_setting: {
            sample_rate: 32000,
            format: "mp3",
            channel: 1,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(
          `MiniMax TTS HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const json = await response.json() as {
        base_resp: { status_code: number; status_msg: string };
        data: { audio: string };
        extra_info: { audio_format?: string; audio_length?: number };
      };

      if (json.base_resp.status_code !== 0) {
        throw new Error(
          `MiniMax TTS application error: ${json.base_resp.status_code} — ${json.base_resp.status_msg}`
        );
      }

      const audioBuffer = Buffer.from(json.data.audio, "hex");
      const result: TTSResult = {
        audioBuffer,
        audioFormat: json.extra_info.audio_format ?? "mp3",
        durationMs: json.extra_info.audio_length ?? 0,
      };

      // Annotate BEFORE callback returns — span finishes on return
      tracer.llmobs.annotate(span, {
        inputData: cleanText.slice(0, 200),
        outputData: JSON.stringify({
          byteLength: audioBuffer.byteLength,
          model,
          voice: VOICE_MAP[voice],
          mood: options.mood ?? "neutral",
        }),
        tags: { "tts.provider": "minimax", "tts.model": model, "tts.voice": voice },
      });

      // ── Store in cache ──────────────────────────────────────────────────
      // L1: store in LRU memory cache (byte-budget eviction handled automatically)
      ttsCache.set(cacheKey, { result, createdAt: Date.now() });

      // L2: store in S3 (fire-and-forget, non-blocking — does NOT add latency to TTS response)
      s3Put(s3Key, result.audioBuffer, "audio/mpeg", {
        voice: VOICE_MAP[voice],
        mood: options.mood ?? "none",
        model,
      }).catch((err) =>
        logEvent("warn", "tts.s3_cache_put_failed", { s3Key, error: String(err) })
      );

      logEvent("info", "tts.api_call_completed", {
        cacheKey,
        preHashKey: preHashKey.slice(0, 120),
        textLength: cleanText.length,
        voice,
        model,
        byteLength: audioBuffer.byteLength,
        cacheSize: ttsCache.size,
      });

      return result;
    }
  );
}

/**
 * Generate TTS for text that may contain multiple character voice segments.
 * Generates audio for each segment concurrently via Promise.allSettled.
 */
export async function generateMultiVoiceTTS(
  text: string,
  options: Omit<TTSOptions, "voice"> = {}
): Promise<TTSResult> {
  const expandedText = expandPhrases(text);
  const [mood, cleanText] = extractMood(expandedText);
  const segments = splitVoiceSegments(cleanText);
  const effectiveMood = options.mood ?? mood ?? undefined;

  const startMs = Date.now();

  // Fan-out: each segment runs concurrently with self-contained fallback
  const settled = await Promise.allSettled(
    segments.map(async (segment) => {
      try {
        return await generateTTS(segment.text, {
          ...options,
          mood: effectiveMood,
          voice: segment.voice,
        });
      } catch (err) {
        if (segment.voice !== "narrator") {
          logEvent("warn", "tts.voice_fallback", {
            failedVoice: segment.voice,
            voiceId: VOICE_MAP[segment.voice],
            error: String(err),
          });
          return await generateTTS(segment.text, {
            ...options,
            mood: effectiveMood,
            voice: "narrator",
          });
        }
        throw err; // narrator failure propagates to allSettled as rejected
      }
    })
  );

  // Collect results in original segment order; rethrow first narrator failure
  const buffers: Buffer[] = [];
  let totalDuration = 0;

  for (const result of settled) {
    if (result.status === "rejected") {
      throw result.reason;
    }
    buffers.push(result.value.audioBuffer);
    totalDuration += result.value.durationMs;
  }

  logEvent("info", "tts.multi_voice_completed", {
    segmentCount: segments.length,
    durationMs: Date.now() - startMs,
    totalAudioDurationMs: totalDuration,
    parallelism: true,
  });

  return {
    audioBuffer: Buffer.concat(buffers),
    audioFormat: "mp3",
    durationMs: totalDuration,
  };
}
