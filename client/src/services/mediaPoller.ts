// Shared fetch-poll-retry utility for media endpoints (music, scene video).
// Handles 202 polling with exponential backoff, error retries, and 401 token refresh.

import { pushError } from './errorStore';
import { authHeaders, refreshAccessToken } from './auth';

export interface MediaPollerConfig {
  url: string;
  label: string;             // e.g. "Music" — for console/error messages
  initialPollDelayMs: number;
  backoffBaseMs: number;
  backoffCapMs: number;
  maxPolls: number;
  retryIntervalMs: number;
  maxRetries: number;
  isStale: () => boolean;
}

function getPollDelay(pollCount: number, config: MediaPollerConfig): number {
  return Math.min(config.backoffBaseMs * Math.pow(2, pollCount), config.backoffCapMs);
}

/**
 * Poll a media endpoint until it returns a blob.
 * - 202: generation in progress — poll with exponential backoff
 * - 401: attempt token refresh once, then retry
 * - Other errors: retry up to maxRetries with fixed interval
 * - Returns Blob on success, null on failure/staleness
 */
export async function pollForMedia(config: MediaPollerConfig): Promise<Blob | null> {
  const { url, label, isStale } = config;
  let polls = 0;
  let retries = 0;
  let hasRefreshed = false;

  for (;;) {
    if (isStale()) return null;

    let res: Response;
    try {
      res = await fetch(url, { headers: authHeaders() });
    } catch (err) {
      console.warn(`[${label.toLowerCase()}] network error:`, err);
      pushError(label, `Network error loading ${label.toLowerCase()}`);
      return null;
    }

    if (isStale()) return null;

    // 401 -> attempt token refresh once, then retry the request
    if (res.status === 401 && !hasRefreshed) {
      hasRefreshed = true;
      const ok = await refreshAccessToken();
      if (!ok || isStale()) return null;
      continue;
    }

    // 202 -> generation in progress, poll with backoff
    if (res.status === 202) {
      polls++;
      if (polls > config.maxPolls) {
        console.warn(`[${label.toLowerCase()}] max polls reached`);
        pushError(label, `${label} generation timed out`);
        return null;
      }
      const delay = polls === 1 ? config.initialPollDelayMs : getPollDelay(polls, config);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Non-ok -> retry with fixed interval
    if (!res.ok) {
      retries++;
      if (retries <= config.maxRetries) {
        console.warn(`[${label.toLowerCase()}] error ${res.status}, retry ${retries}/${config.maxRetries}`);
        await new Promise((r) => setTimeout(r, config.retryIntervalMs));
        if (isStale()) return null;
        continue;
      }
      console.warn(`[${label.toLowerCase()}] max retries reached`);
      pushError(label, `Failed to load ${label.toLowerCase()} after ${config.maxRetries} retries`);
      return null;
    }

    // Success
    return res.blob();
  }
}
