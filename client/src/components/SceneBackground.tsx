import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from 'react';
import { subscribe, getCurrentVideoUrl } from '../services/sceneVideo';

const CROSSFADE_MS = 600;
const CAPTURE_FPS = 30;
const FRAME_MS = 1000 / CAPTURE_FPS;

function videoMimeType(src: string): string {
  return src.endsWith('.webm') ? 'video/webm' : 'video/mp4';
}

/**
 * Captures frames at ~30 fps during the first native forward play,
 * then loops forever as a canvas-driven ping-pong (forward ↔ backward).
 * No seeking involved after initial play — no stutter.
 */
function usePingPong(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  src: string,
) {
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let alive = true;
    const frames: ImageBitmap[] = [];
    let capRaf = 0;
    let drawRaf = 0;
    let lastCapTs = 0;

    const MAX_FRAMES = 60;

    /* Phase 1 — capture frames while video plays forward natively */
    const captureLoop = (ts: number) => {
      if (!alive || video.paused || video.ended) return;
      if (frames.length >= MAX_FRAMES) return;
      if (ts - lastCapTs >= FRAME_MS) {
        lastCapTs = ts;
        createImageBitmap(video)
          .then(b => { if (alive) frames.push(b); else b.close(); })
          .catch(() => {});
      }
      capRaf = requestAnimationFrame(captureLoop);
    };

    /* Phase 2 — canvas-rendered ping-pong from captured frames */
    const startCanvasLoop = () => {
      if (frames.length < 2) {
        // Too few frames captured — simple restart fallback
        video.currentTime = 0;
        void video.play();
        return;
      }

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      video.style.visibility = 'hidden';
      canvas.style.visibility = 'visible';

      let idx = frames.length - 1;
      let dir: 1 | -1 = -1; // start going backward
      let lastTs = 0;

      const draw = (ts: number) => {
        if (!alive) return;
        if (!lastTs) lastTs = ts;

        if (ts - lastTs >= FRAME_MS) {
          lastTs = ts;
          ctx.drawImage(frames[idx], 0, 0, canvas.width, canvas.height);
          idx += dir;
          if (idx <= 0) { idx = 0; dir = 1; }
          else if (idx >= frames.length - 1) { idx = frames.length - 1; dir = -1; }
        }

        drawRaf = requestAnimationFrame(draw);
      };

      drawRaf = requestAnimationFrame(draw);
    };

    const onPlay = () => {
      if (frames.length === 0) {
        lastCapTs = 0;
        capRaf = requestAnimationFrame(captureLoop);
      }
    };

    const onEnded = () => {
      cancelAnimationFrame(capRaf);
      startCanvasLoop();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('ended', onEnded);

    // If already playing (autoplay), kick off capture immediately
    if (!video.paused && !video.ended) onPlay();

    return () => {
      alive = false;
      video.removeEventListener('play', onPlay);
      video.removeEventListener('ended', onEnded);
      cancelAnimationFrame(capRaf);
      cancelAnimationFrame(drawRaf);
      frames.forEach(f => f.close());
    };
  }, [videoRef, canvasRef, src]);
}

/** Video + canvas pair with automatic ping-pong looping. */
function PingPongVideo({ src, onCanPlay }: { src: string; onCanPlay?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  usePingPong(videoRef, canvasRef, src);

  const fill = 'absolute inset-0 w-full h-full object-cover';

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        className={fill}
        onCanPlay={onCanPlay}
      >
        <source src={src} type={videoMimeType(src)} />
      </video>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={fill}
        style={{ visibility: 'hidden' }}
      />
    </>
  );
}

export function SceneBackground() {
  const videoUrl = useSyncExternalStore(subscribe, getCurrentVideoUrl);
  const [activeUrl, setActiveUrl] = useState(videoUrl);
  const [incomingUrl, setIncomingUrl] = useState<string | null>(null);
  const [incomingReady, setIncomingReady] = useState(false);
  const prevUrlRef = useRef(videoUrl);

  // Detect when videoUrl changes from the store
  if (videoUrl !== prevUrlRef.current) {
    prevUrlRef.current = videoUrl;
    if (videoUrl !== activeUrl) {
      setIncomingUrl(videoUrl);
      setIncomingReady(false);
    }
  }

  const handleIncomingCanPlay = useCallback(() => {
    setIncomingReady(true);
    // After crossfade duration, promote incoming to active
    setTimeout(() => {
      setIncomingUrl(prev => {
        if (prev) setActiveUrl(prev);
        return null;
      });
      setIncomingReady(false);
    }, CROSSFADE_MS);
  }, []);

  return (
    <>
      {/* Active layer */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{ opacity: incomingReady ? 0 : 1, transitionDuration: `${CROSSFADE_MS}ms` }}
      >
        <PingPongVideo key={activeUrl} src={activeUrl} />
      </div>

      {/* Incoming layer (crossfade) */}
      {incomingUrl && (
        <div
          className="absolute inset-0 transition-opacity"
          style={{ opacity: incomingReady ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
        >
          <PingPongVideo key={incomingUrl} src={incomingUrl} onCanPlay={handleIncomingCanPlay} />
        </div>
      )}
    </>
  );
}
