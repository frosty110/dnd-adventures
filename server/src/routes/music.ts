import { Router } from "express";
import { config } from "../services/config.js";
import { logEvent } from "../services/logger.js";
import { getMusicForMood, getRandomMusic, getMusicCacheStats, VALID_MOODS } from "../services/musicService.js";
import { type SceneMood } from "@dnd-adventures/shared-types";

export { getMusicCacheStats };

const router = Router();

router.get("/api/music/random", async (req, res) => {
  const audio = await getRandomMusic();
  if (!audio) {
    res.status(404).json({ error: "No cached music available" });
    return;
  }
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", audio.length);
  res.setHeader("Cache-Control", "no-cache");
  res.send(audio);
});

router.get("/api/music", async (req, res) => {
  if (!config.MINIMAX_MUSIC_API_KEY && !config.MINIMAX_API_KEY) {
    logEvent("warn", "music.not_configured", { route: "/api/music" });
    res.status(503).json({ error: "Music not configured" });
    return;
  }

  // Validate mood query param (default to "tavern")
  const rawMood = typeof req.query.mood === "string" ? req.query.mood : "tavern";
  const mood: SceneMood = VALID_MOODS.includes(rawMood as SceneMood)
    ? (rawMood as SceneMood)
    : "tavern";

  const result = await getMusicForMood(mood);

  switch (result.status) {
    case "ready":
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", result.audio.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(result.audio);
      break;

    case "generating":
    case "retrying":
      res.status(202).json({ status: "generating", mood, startedAt: result.startedAt });
      break;

    case "error":
      res.status(500).json({ error: result.error, ...(result.terminal && { terminal: true }) });
      break;
  }
});

export default router;
