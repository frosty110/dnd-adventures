// Background music player — mood-aware with crossfade and TTS ducking.

import { authHeaders } from './auth';
import { pollForMedia } from './mediaPoller';
import { API_BASE } from './apiBase';
import { type SceneMood, VALID_MOODS } from '@dnd-adventures/shared-types';

const DEFAULT_VOLUME = 0.12;
const DUCK_VOLUME = 0.03;
const CROSSFADE_MS = 800;
const DUCK_DOWN_MS = 200;
const DUCK_UP_MS = 500;
const INITIAL_POLL_DELAY_MS = 10_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 30_000;
const RETRY_INTERVAL_MS = 10000;
const MAX_RETRIES = 5;
const MAX_POLLS = 30;

// --- State ---
let currentTrack: HTMLAudioElement | null = null;
let currentMood: SceneMood | null = null;
let userVolume = DEFAULT_VOLUME;
let isDucked = false;
let paused = false;
let isIntroMusic = false;

// Generation counter — incremented on stop/reset to invalidate stale async work
let generation = 0;

// Per-mood blob URL cache
const moodBlobUrls = new Map<SceneMood, string>();
const fetchingMoods = new Set<SceneMood>();
let introBlobUrl: string | null = null;

// Crossfade state
let crossfadeRaf: number | null = null;
let crossfadeOldTrack: HTMLAudioElement | null = null;

// Ducking animation
let duckRaf: number | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

// --- Volume animation helper ---
function animateVolume(
  track: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  onDone?: () => void,
): number {
  const start = performance.now();
  function step(now: number) {
    const elapsed = now - start;
    const t = Math.min(elapsed / durationMs, 1);
    // Ease-in-out for smooth transitions
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    track.volume = from + (to - from) * ease;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      track.volume = to;
      onDone?.();
    }
  }
  return requestAnimationFrame(step);
}

// --- Fetch mood audio ---
async function fetchMoodAudio(mood: SceneMood, gen: number): Promise<string | null> {
  if (gen !== generation) return null;
  if (moodBlobUrls.has(mood)) return moodBlobUrls.get(mood)!;
  if (fetchingMoods.has(mood)) return null;

  fetchingMoods.add(mood);
  try {
    const blob = await pollForMedia({
      url: `${API_BASE}/api/music?mood=${mood}`,
      label: "Music",
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
    moodBlobUrls.set(mood, url);
    return url;
  } finally {
    fetchingMoods.delete(mood);
  }
}

// --- Crossfade ---
function crossfadeTo(blobUrl: string, mood: SceneMood) {
  // Cancel any in-progress crossfade
  if (crossfadeRaf !== null) {
    cancelAnimationFrame(crossfadeRaf);
    crossfadeRaf = null;
  }
  if (crossfadeOldTrack) {
    crossfadeOldTrack.pause();
    crossfadeOldTrack = null;
  }

  const oldTrack = currentTrack;
  const targetVolume = isDucked ? DUCK_VOLUME : userVolume;

  const newTrack = new Audio(blobUrl);
  newTrack.loop = true;
  newTrack.volume = 0;
  newTrack.preload = 'auto';

  currentTrack = newTrack;
  currentMood = mood;
  // Revoke intro blob URL when replaced by game music
  if (isIntroMusic && introBlobUrl) {
    URL.revokeObjectURL(introBlobUrl);
    introBlobUrl = null;
  }
  isIntroMusic = false;

  if (paused) {
    // Don't play if paused, just swap the reference
    if (oldTrack) {
      oldTrack.pause();
    }
    newTrack.volume = targetVolume;
    notify();
    return;
  }

  const playPromise = newTrack.play();
  playPromise?.catch((err) => console.warn('[music] play() failed:', err));

  if (oldTrack) {
    const fadingTrack = oldTrack;
    crossfadeOldTrack = fadingTrack;
    // Ramp old down, new up over CROSSFADE_MS
    const startVol = fadingTrack.volume;
    const start = performance.now();

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / CROSSFADE_MS, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      if (crossfadeOldTrack === fadingTrack) {
        fadingTrack.volume = startVol * (1 - ease);
      }
      newTrack.volume = targetVolume * ease;

      if (t < 1) {
        crossfadeRaf = requestAnimationFrame(step);
      } else {
        // Done
        if (crossfadeOldTrack === fadingTrack) {
          fadingTrack.pause();
          crossfadeOldTrack = null;
        }
        newTrack.volume = targetVolume;
        crossfadeRaf = null;
        notify();
      }
    }

    crossfadeRaf = requestAnimationFrame(step);
  } else {
    // No old track — just fade in (store rAF so next crossfade can cancel it)
    crossfadeRaf = animateVolume(newTrack, 0, targetVolume, CROSSFADE_MS, () => {
      crossfadeRaf = null;
      notify();
    });
  }

  notify();
}

// --- Public API ---

/**
 * Fetch a random track from S3 cache and start playing immediately.
 * Used for landing page music before any mood is selected.
 * Requires a user gesture (click) to satisfy browser autoplay policy.
 */
export async function startRandomMusic() {
  if (currentTrack) return; // already playing

  const gen = generation;
  try {
    const res = await fetch(`${API_BASE}/api/music/random`, { headers: authHeaders() });
    if (!res.ok || gen !== generation) return;

    const blob = await res.blob();
    if (gen !== generation || currentTrack) return; // stale or another track started

    const url = URL.createObjectURL(blob);
    introBlobUrl = url;
    crossfadeTo(url, "tavern"); // label as tavern so mood changes can crossfade from it
    isIntroMusic = true; // mark AFTER crossfadeTo (which clears the flag)
  } catch {
    // Landing music is best-effort — don't break the app
  }
}

// --- Mood transition map for prefetching ---
const MOOD_TRANSITIONS: Record<SceneMood, SceneMood[]> = {
  tavern:      ["exploration", "combat"],
  exploration: ["combat", "mystery"],
  combat:      ["exploration", "dramatic"],
  mystery:     ["danger", "dramatic"],
  dramatic:    ["combat", "exploration"],
  danger:      ["combat", "dramatic"],
};

function prefetchMoods(moods: SceneMood[]) {
  const gen = generation;
  for (const mood of moods) {
    if (!moodBlobUrls.has(mood) && !fetchingMoods.has(mood)) {
      void fetchMoodAudio(mood, gen);
    }
  }
}

export async function changeMood(mood: string | undefined) {
  if (!mood) return;
  if (!VALID_MOODS.includes(mood as SceneMood)) return;
  const sceneMood = mood as SceneMood;

  if (sceneMood === currentMood) return;

  console.log(`[music] changing mood: ${currentMood} -> ${sceneMood}`);

  const gen = generation;

  // If we already have the blob URL, crossfade immediately
  const cached = moodBlobUrls.get(sceneMood);
  if (cached) {
    crossfadeTo(cached, sceneMood);
    prefetchMoods(MOOD_TRANSITIONS[sceneMood] ?? []);
    return;
  }

  // Fetch in background, keep current track playing until ready
  const url = await fetchMoodAudio(sceneMood, gen);
  if (url && gen === generation) {
    crossfadeTo(url, sceneMood);
    prefetchMoods(MOOD_TRANSITIONS[sceneMood] ?? []);
  }
}

export function duckForTTS() {
  isDucked = true;
  if (duckRaf !== null) cancelAnimationFrame(duckRaf);
  if (currentTrack && !paused) {
    duckRaf = animateVolume(currentTrack, currentTrack.volume, DUCK_VOLUME, DUCK_DOWN_MS, () => {
      duckRaf = null;
    });
  }
}

export function restoreFromTTS() {
  isDucked = false;
  if (duckRaf !== null) cancelAnimationFrame(duckRaf);
  if (currentTrack && !paused) {
    duckRaf = animateVolume(currentTrack, currentTrack.volume, userVolume, DUCK_UP_MS, () => {
      duckRaf = null;
    });
  }
}

export function startBackgroundMusic(initialMood?: string) {
  const mood: SceneMood = (initialMood as SceneMood) || "tavern";

  // If already playing this mood (and it's not just intro music), skip
  if (currentTrack && currentMood === mood && !isIntroMusic) return;

  console.log(`[music] starting with mood: ${mood}`);
  const gen = generation;

  // Kick off fetch for the initial mood — crossfade replaces any current track (including intro)
  void (async () => {
    const url = await fetchMoodAudio(mood, gen);
    if (url && gen === generation) {
      crossfadeTo(url, mood);
    }
  })();
}

export function stopBackgroundMusic() {
  // Bump generation to invalidate all in-flight fetches and stale setTimeout callbacks
  generation++;
  if (crossfadeRaf !== null) {
    cancelAnimationFrame(crossfadeRaf);
    crossfadeRaf = null;
  }
  if (crossfadeOldTrack) {
    crossfadeOldTrack.pause();
    crossfadeOldTrack = null;
  }
  if (duckRaf !== null) {
    cancelAnimationFrame(duckRaf);
    duckRaf = null;
  }
  if (currentTrack) {
    currentTrack.pause();
    currentTrack = null;
  }
  currentMood = null;
  paused = false;
  isDucked = false;
  isIntroMusic = false;
  fetchingMoods.clear();
  // Revoke all cached blob URLs to prevent memory leaks
  for (const url of moodBlobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  moodBlobUrls.clear();
  if (introBlobUrl) {
    URL.revokeObjectURL(introBlobUrl);
    introBlobUrl = null;
  }
  notify();
}

export function setVolume(v: number) {
  userVolume = Math.max(0, Math.min(1, v));
  // Only update the audio element if not ducked
  if (!isDucked && currentTrack) {
    currentTrack.volume = userVolume;
  }
  notify();
}

export function getVolume() {
  return userVolume;
}

export function togglePause() {
  if (!currentTrack) return;
  if (paused) {
    currentTrack.play().catch(() => {});
    paused = false;
  } else {
    currentTrack.pause();
    // Also stop any crossfading old track so the user hears complete silence
    if (crossfadeOldTrack) {
      crossfadeOldTrack.pause();
      crossfadeOldTrack = null;
    }
    if (crossfadeRaf !== null) {
      cancelAnimationFrame(crossfadeRaf);
      crossfadeRaf = null;
    }
    paused = true;
  }
  notify();
}

export function isPaused() {
  return paused;
}

export function isReady() {
  return currentTrack !== null;
}
