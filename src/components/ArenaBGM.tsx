// /src/components/ArenaBGM.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Looping background music that starts when `active` becomes true.
 * - Handles browser autoplay policies by "unlocking" audio on first user gesture.
 * - Persists a single <audio> element and cleans up on unmount.
 * - Optional volume prop (0..1). Defaults to 0.55.
 */
export default function ArenaBGM({
  active,
  src = "/music/arena-bgm.mp3",
  volume = 0.55,
}: {
  active: boolean;
  src?: string;
  volume?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  // Lazily create the audio element once
  const el = useMemo(() => {
    if (typeof window === "undefined") return null;
    const audio = new Audio();
    audio.src = src;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = Math.min(Math.max(volume, 0), 1);
    return audio;
  }, [src, volume]);

  // Keep a ref for imperative control
  useEffect(() => {
    if (!el) return;
    audioRef.current = el;

    // Attempt best-effort pre-play (might be blocked until user interacts)
    const tryPlay = async () => {
      try {
        await el.play();
      } catch {
        // Swallow—will be unlocked by user gesture below
      }
    };

    // User gesture unlock handler
    const unlock = async () => {
      if (!audioRef.current) return;
      try {
        await audioRef.current.play();
        setUnlocked(true);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      } catch {
        // If still blocked, keep listeners; some browsers need another gesture
      }
    };

    if (active) {
      // If already unlocked, just play; else set up unlock listeners
      if (unlocked) {
        tryPlay();
      } else {
        window.addEventListener("pointerdown", unlock, { passive: true });
        window.addEventListener("keydown", unlock);
      }
    } else {
      el.pause();
      el.currentTime = 0;
    }

    return () => {
      // Pause (don’t destroy the element so re-activating is instant)
      el.pause();
      // Clean listeners if any still attached
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [active, el, unlocked]);

  // React to volume changes at runtime
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(Math.max(volume, 0), 1);
    }
  }, [volume]);

  return null; // no visible UI
}
