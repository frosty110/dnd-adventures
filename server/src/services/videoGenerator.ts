import { LRUCache } from "lru-cache";
import tracer from "dd-trace";
import { config } from "./config.js";
import { logEvent } from "./logger.js";
import { buildKey, get as s3Get, put as s3Put } from "./mediaCache.js";
import { recordVideoUsage } from "./usageTracker.js";
import type { SceneId } from "@dnd-adventures/shared-types";
import { SCENE_PROMPTS } from "../content/scenePrompts.js";

interface SceneCacheEntry {
  generating: boolean;
  error: string | null;
  lastFailedAt: number | null;
  retryCount: number;
  generationStartedAt: number | null;
}

/** Metadata map: tracks generation state per scene */
const sceneVideoCache = new Map<SceneId, SceneCacheEntry>();

/** LRU buffer cache: stores actual video Buffers with 500MB byte budget and 1-hour TTL */
const videoBufferCache = new LRUCache<string, Buffer>({
  maxSize: 500 * 1024 * 1024, // 500MB byte budget
  sizeCalculation: (buf) => buf.byteLength,
  ttl: 60 * 60 * 1000, // 1 hour TTL
  allowStale: false,
});

const RETRY_COOLDOWN_MS = 60_000;
const MAX_RETRIES = 2;
const GENERATION_TIMEOUT_MS = 180_000;
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 10_000;

let videoCacheHits = 0;
let videoCacheMisses = 0;

export function getSceneVideoStats() {
  const scenes: Record<string, boolean> = {};
  for (const [scene] of sceneVideoCache) {
    scenes[scene] = videoBufferCache.has(scene);
  }
  return {
    hits: videoCacheHits,
    misses: videoCacheMisses,
    scenes,
    byteSize: videoBufferCache.calculatedSize,
  };
}

export function buildVideoS3Key(scene: SceneId): string {
  return buildKey("video/v1", `video-01|${scene}|${SCENE_PROMPTS[scene]}`, "mp4");
}

/**
 * Try loading a scene video from S3 into the L1 cache.
 * Returns true if the video was loaded from S3.
 */
export async function tryLoadFromS3(scene: SceneId): Promise<boolean> {
  const entry = getOrCreateEntry(scene);
  if (videoBufferCache.has(scene) || entry.generating) return false;
  try {
    const s3Buf = await s3Get(buildVideoS3Key(scene));
    if (s3Buf) {
      videoBufferCache.set(scene, s3Buf);
      tracer.dogstatsd.increment('cache.hit', 1, { cache_type: 'video', source: 's3' });
      logEvent("info", "video.s3_cache_hit", { scene, bytes: s3Buf.length });
      return true;
    }
  } catch (err) {
    logEvent("warn", "video.s3_cache_get_failed", { scene, error: String(err) });
  }
  return false;
}

/**
 * Get the video buffer for a scene from the LRU cache, if available.
 * Returns undefined if the video is not in the cache.
 */
export function getVideoBuffer(scene: SceneId): Buffer | undefined {
  return videoBufferCache.get(scene);
}

/**
 * Check whether a scene video is in the LRU cache.
 */
export function hasVideoBuffer(scene: SceneId): boolean {
  return videoBufferCache.has(scene);
}

export function getOrCreateEntry(scene: SceneId): SceneCacheEntry {
  let entry = sceneVideoCache.get(scene);
  if (!entry) {
    entry = { generating: false, error: null, lastFailedAt: null, retryCount: 0, generationStartedAt: null };
    sceneVideoCache.set(scene, entry);
  }
  return entry;
}

export function startGeneration(scene: SceneId) {
  const entry = getOrCreateEntry(scene);
  if (entry.generating || videoBufferCache.has(scene)) return;
  if (entry.retryCount >= MAX_RETRIES) return;
  if (entry.error && entry.lastFailedAt && Date.now() - entry.lastFailedAt < RETRY_COOLDOWN_MS) return;
  if (entry.error) {
    entry.retryCount++;
    logEvent("info", "video.retrying_after_failure", {
      scene,
      previousError: entry.error,
      retryCount: entry.retryCount,
      maxRetries: MAX_RETRIES,
    });
    entry.error = null;
  }
  entry.generating = true;
  entry.generationStartedAt = Date.now();

  logEvent("info", "video.generation_started", {
    scene,
    model: "video-01",
    provider: "minimax",
  });

  void runGeneration(scene);
}

async function runGeneration(scene: SceneId) {
  const entry = getOrCreateEntry(scene);
  const overallStart = Date.now();
  const prompt = SCENE_PROMPTS[scene];

  try {
    const apiKey = config.MINIMAX_API_KEY;

    // Step 1: Submit video generation task
    const submitRes = await fetch("https://api.minimax.io/v1/video_generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "video-01",
        prompt,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!submitRes.ok) throw new Error(`MiniMax video submit HTTP ${submitRes.status}`);

    const submitJson = (await submitRes.json()) as {
      base_resp?: { status_code: number; status_msg: string };
      task_id?: string;
    };

    if (submitJson.base_resp && submitJson.base_resp.status_code !== 0) {
      throw new Error(`MiniMax video submit error: ${submitJson.base_resp.status_msg}`);
    }

    const taskId = submitJson.task_id;
    if (!taskId) throw new Error("No task_id in video generation response");

    logEvent("info", "video.task_submitted", { scene, taskId });

    // Step 2: Poll for completion
    let fileId: string | null = null;
    const pollStart = Date.now();
    let attempt = 0;

    while (Date.now() - pollStart < GENERATION_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      attempt++;

      const pollRes = await fetch(
        `https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!pollRes.ok) throw new Error(`MiniMax video poll HTTP ${pollRes.status}`);

      const pollJson = (await pollRes.json()) as {
        base_resp?: { status_code: number; status_msg: string };
        status?: string;
        file_id?: string;
      };

      logEvent("info", "video.poll_progress", {
        scene,
        taskId,
        attempt,
        maxAttempts: Math.floor(GENERATION_TIMEOUT_MS / POLL_INTERVAL_MS),
        status: pollJson.status ?? "unknown",
        elapsedMs: Date.now() - pollStart,
      });

      if (pollJson.base_resp && pollJson.base_resp.status_code !== 0) {
        throw new Error(`MiniMax video poll error: ${pollJson.base_resp.status_msg}`);
      }

      if (pollJson.status === "Fail") {
        throw new Error("MiniMax video generation failed");
      }

      if (pollJson.status === "Success" && pollJson.file_id) {
        fileId = pollJson.file_id;
        break;
      }
    }

    if (!fileId) throw new Error("Video generation timed out");

    logEvent("info", "video.generation_complete", { scene, taskId, fileId });

    // Step 3: Get download URL
    const fileRes = await fetch(
      `https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!fileRes.ok) throw new Error(`MiniMax file retrieve HTTP ${fileRes.status}`);

    const fileJson = (await fileRes.json()) as {
      base_resp?: { status_code: number; status_msg: string };
      file?: { download_url?: string };
    };

    const downloadUrl = fileJson.file?.download_url;
    if (!downloadUrl) throw new Error("No download_url in file retrieve response");

    // Step 4: Download the video
    const videoRes = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    videoBufferCache.set(scene, videoBuffer);

    // L2: fire-and-forget S3 persist
    s3Put(buildVideoS3Key(scene), videoBuffer, "video/mp4", { scene, model: "video-01" })
      .catch((err) => logEvent("warn", "video.s3_cache_put_failed", { scene, error: String(err) }));

    const generationDurationMs = Date.now() - overallStart;
    const videoSizeBytes = videoBuffer.length;
    recordVideoUsage();

    try {
      tracer.llmobs.trace(
        { kind: "tool", name: "minimax.video_generation" },
        (span) => {
          tracer.llmobs.annotate(span, {
            inputData: JSON.stringify({ prompt: prompt.slice(0, 200), model: "video-01", scene }),
            outputData: JSON.stringify({
              videoSizeBytes,
              format: "mp4",
            }),
            metrics: {
              generationDurationMs,
              videoSizeBytes,
            },
            tags: {
              "video.provider": "minimax",
              "video.model": "video-01",
              "video.scene": scene,
            },
          });
        },
      );
    } catch { /* tracing failure should not affect video delivery */ }

    logEvent("info", "video.generation_completed", {
      scene,
      generationDurationMs,
      videoSizeBytes,
      videoSizeKB: Math.round(videoSizeBytes / 1024),
    });
  } catch (err) {
    entry.error = String(err);
    entry.lastFailedAt = Date.now();
    const totalMs = Date.now() - overallStart;

    try {
      tracer.llmobs.trace(
        { kind: "tool", name: "minimax.video_generation" },
        (span) => {
          tracer.llmobs.annotate(span, {
            inputData: JSON.stringify({ prompt: prompt.slice(0, 200), model: "video-01", scene }),
            outputData: JSON.stringify({ error: entry.error }),
            tags: {
              "video.provider": "minimax",
              "video.model": "video-01",
              "video.error": "true",
              "video.scene": scene,
            },
          });
        },
      );
    } catch { /* tracing failure should not affect error reporting */ }

    logEvent(
      "error",
      "video.generation_failed",
      {
        scene,
        durationMs: totalMs,
        failureType: "terminal",
      },
      err,
    );
  } finally {
    entry.generating = false;
  }
}
