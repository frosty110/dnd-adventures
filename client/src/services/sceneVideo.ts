// Scene video controller — fetches scene-specific background videos with polling and caching.

import { pollForMedia } from './mediaPoller';
import { API_BASE } from './apiBase';

const DEFAULT_VIDEO_URL = "/hero-bg.webm";
const INITIAL_POLL_DELAY_MS = 15_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 30_000;
const MAX_POLLS = 40;
const RETRY_INTERVAL_MS = 10000;
const MAX_RETRIES = 3;

// Generation counter — incremented on reset to invalidate stale async work
let generation = 0;

// --- State ---
let currentScene: string | null = null;
let currentVideoUrl: string = DEFAULT_VIDEO_URL;

// Per-scene blob URL cache (permanent for session)
const sceneBlobUrls = new Map<string, string>();
const fetchingScenes = new Set<string>();

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function getCurrentVideoUrl(): string {
  return currentVideoUrl;
}

export function getCurrentScene(): string | null {
  return currentScene;
}

async function fetchSceneVideo(scene: string, gen: number): Promise<string | null> {
  if (gen !== generation) return null;
  if (sceneBlobUrls.has(scene)) return sceneBlobUrls.get(scene)!;
  if (fetchingScenes.has(scene)) return null;

  fetchingScenes.add(scene);
  try {
    const blob = await pollForMedia({
      url: `${API_BASE}/api/scene-video?scene=${scene}`,
      label: "Video",
      initialPollDelayMs: INITIAL_POLL_DELAY_MS,
      backoffBaseMs: BACKOFF_BASE_MS,
      backoffCapMs: BACKOFF_CAP_MS,
      maxPolls: MAX_POLLS,
      retryIntervalMs: RETRY_INTERVAL_MS,
      maxRetries: MAX_RETRIES,
      isStale: () => gen !== generation,
    });
    if (!blob || gen !== generation) return null;
    const url = URL.createObjectURL(blob);
    sceneBlobUrls.set(scene, url);
    return url;
  } finally {
    fetchingScenes.delete(scene);
  }
}

export async function changeScene(scene: string | undefined) {
  if (!scene) return;
  if (scene === currentScene) return;

  console.log(`[scene-video] changing scene: ${currentScene} -> ${scene}`);

  // If we already have the blob URL, swap immediately
  const cached = sceneBlobUrls.get(scene);
  if (cached) {
    currentScene = scene;
    currentVideoUrl = cached;
    notify();
    return;
  }

  // Fetch in background, keep current video until ready
  const gen = generation;
  const url = await fetchSceneVideo(scene, gen);
  if (url && gen === generation) {
    currentScene = scene;
    currentVideoUrl = url;
    notify();
  }
}

export function resetScenes() {
  generation++;
  for (const url of sceneBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  sceneBlobUrls.clear();
  currentScene = null;
  currentVideoUrl = DEFAULT_VIDEO_URL;
  fetchingScenes.clear();
  notify();
}
