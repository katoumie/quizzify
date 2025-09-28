// src/app/(game)/duels/[code]/arena/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/** Minimal custom fuzzy/glow text (no external deps) */
function PixelGlowText({
  children,
  size = "clamp(3rem, 8vw, 9rem)",
  weight = 900,
  color = "#fff",
  family = "font-mona",
}: {
  children: React.ReactNode;
  size?: string;
  weight?: number;
  color?: string;
  family?: string;
}) {
  return (
    <span
      className="qz-glow relative inline-block select-none"
      style={{ fontSize: size, fontWeight: weight as any, color, fontFamily: family as any }}
    >
      {/* main */}
      <span className="relative z-10">{children}</span>
      {/* soft outer white halo */}
      <span
        className="absolute inset-0 z-0 opacity-80"
        aria-hidden
        style={{ filter: "blur(3px)", color, mixBlendMode: "screen" }}
      >
        {children}
      </span>
      {/* colored jitter outlines for “fuzz” */}
      <span className="qz-jitter absolute inset-0 z-0 opacity-35" aria-hidden style={{ color: "#7cc0ff" }}>
        {children}
      </span>
      <span className="qz-jitter qz-jitter-r absolute inset-0 z-0 opacity-35" aria-hidden style={{ color: "#f6aaff" }}>
        {children}
      </span>
      <style jsx>{`
        .qz-glow {
          letter-spacing: 0.04em;
          text-shadow: 0 6px 0 rgba(0, 0, 0, 0.38), 0 14px 22px rgba(0, 0, 0, 0.45);
          image-rendering: pixelated;
        }
        @keyframes qz-j {
          0% { transform: translate(0.2px, 0); }
          25% { transform: translate(-0.3px, 0.15px); }
          50% { transform: translate(0.35px, -0.2px); }
          75% { transform: translate(-0.25px, -0.1px); }
          100% { transform: translate(0.2px, 0); }
        }
        .qz-jitter { animation: qz-j 420ms steps(6, end) infinite; mix-blend-mode: screen; filter: blur(0.6px) contrast(1.1); }
        .qz-jitter-r { animation-delay: 80ms; }
      `}</style>
    </span>
  );
}

export default function ArenaEmptyPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = Array.isArray(raw) ? raw[0] : raw;
  const router = useRouter();

  // BGM (loop, low volume)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const didInitAudio = useRef(false);
  useEffect(() => {
    if (didInitAudio.current) return;
    didInitAudio.current = true;
    const el = audioRef.current;
    if (!el) return;
    el.loop = true;
    el.volume = 0.22;
    el.play().catch(() => {});
  }, []);

  // Phases + timing
  const STEP = 1200;   // ms per countdown tick
  const GO_HOLD = 1000;
  const TITLE_MS = 3000;
  const XFADE_MS = 400;     // crossfade duration
  const COUNT_DELAY = 120;  // small delay so "3" appears after fade starts

  // Title pulse restart key
  const [titlePulse, setTitlePulse] = useState(0);

  // Show/transition flags
  const [showTitle, setShowTitle] = useState(true);
  const [titleFadeOut, setTitleFadeOut] = useState(false);

  const [showCountdown, setShowCountdown] = useState(false);
  const [countFadeIn, setCountFadeIn] = useState(false);

  // Countdown value
  const [count, setCount] = useState<3 | 2 | 1 | 0 | -1>(3);

  // Timers guarded for Strict Mode
  const didInitTimers = useRef(false);
  useEffect(() => {
    if (didInitTimers.current) return;
    didInitTimers.current = true;

    // Title pulse loop
    const pulseInterval = setInterval(() => setTitlePulse((k) => k + 1), 900);

    // After TITLE_MS, begin crossfade and countdown
    const endTitle = setTimeout(() => {
      // show countdown (hidden, will fade-in)
      setShowCountdown(true);
      setCountFadeIn(true);

      // start title fade-out
      setTitleFadeOut(true);

      // actually start the countdown just after fade begins
      const startCountdown = setTimeout(() => {
        setCount(3);
        const t1 = setTimeout(() => setCount(2), STEP * 1);
        const t2 = setTimeout(() => setCount(1), STEP * 2);
        const t3 = setTimeout(() => setCount(0), STEP * 3);
        const tGo = setTimeout(() => setCount(-1), STEP * 4);
        const tHide = setTimeout(() => {
          setShowCountdown(false);
        }, STEP * 4 + GO_HOLD);

        // cleanup for countdown timers
        cleanup.push(t1, t2, t3, tGo, tHide);
      }, COUNT_DELAY);

      // when crossfade done, remove title overlay
      const finishFade = setTimeout(() => setShowTitle(false), XFADE_MS);

      cleanup.push(startCountdown, finishFade);
    }, TITLE_MS);

    const cleanup: Array<ReturnType<typeof setTimeout>> = [endTitle];

    return () => {
      clearInterval(pulseInterval);
      cleanup.forEach(clearTimeout);
    };
  }, []);

  const label = count === -1 ? "GO!" : count === 0 ? "" : String(count);
  const isGo = count === -1;

  return (
    <main className="min-h-dvh w-full text-white relative overflow-hidden">
      {/* BGM */}
      <audio ref={audioRef} src="/music/arena-bgm.mp3" preload="auto" autoPlay loop />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <button
          className="rounded-lg bg-white/10 hover:bg-white/15 ring-1 ring-white/20 px-3 py-1.5 text-sm"
          onClick={() => router.push(`/duels/${code}`)}
        >
          Leave
        </button>
        <div className="text-sm text-white/80">Arena</div>
        <div />
      </div>

      {/* Center (placeholder) */}
      <div className="min-h-dvh grid place-items-center px-6">
        <div className="text-white/80 text-lg">Arena screen (empty template)</div>
      </div>

      {/* TITLE: "ARENA" with pulse, then fade-out */}
      {showTitle && (
        <div className="pointer-events-none fixed inset-0 z-20 grid place-items-center">
          <div
            className={[
              "origin-center scale-[1.4] sm:scale-[1.7] md:scale-[2.0] lg:scale-[2.3]",
              titleFadeOut ? "fade-out" : "fade-in",
            ].join(" ")}
          >
            <div key={titlePulse} className="inline-block title-pop">
              <PixelGlowText
                size="clamp(3rem, 8vw, 9rem)"
                weight={900}
                color="#fff"
                family="var(--font-ritasmith)"
              >
                ARENA
              </PixelGlowText>
            </div>
          </div>
        </div>
      )}

      {/* COUNTDOWN: fade-in while title fades out */}
      {showCountdown && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-visible grid place-items-center">
          <div
            className={[
              "origin-center scale-[1.6] sm:scale-[1.9] md:scale-[2.2] lg:scale-[2.6]",
              countFadeIn ? "fade-in-up" : "",
            ].join(" ")}
          >
            <div key={count} className={`inline-block ${isGo ? "go-pop" : "pop"}`}>
              <PixelGlowText
                size="clamp(3rem, 8vw, 9rem)"
                weight={900}
                color="#fff"
                family="var(--font-ritasmith)"
              >
                {label || "\u00A0"}
              </PixelGlowText>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        /* Crossfades */
        @keyframes qz-fade-in   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes qz-fade-out  { from { opacity: 1 } to { opacity: 0 } }
        @keyframes qz-fade-in-up {
          0%   { opacity: 0; transform: translateY(10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0)     scale(1.00); }
        }
        .fade-in     { animation: qz-fade-in    ${XFADE_MS}ms ease-out both; }
        .fade-out    { animation: qz-fade-out   ${XFADE_MS}ms ease-in  both; }
        .fade-in-up  { animation: qz-fade-in-up ${XFADE_MS}ms ease-out both; }

        /* Title pulse (loops; restarted every 900ms via key) */
        @keyframes qz-pulse {
          0%   { transform: translateY(0)    scale(0.86, 1.12) rotate(-3deg); }
          28%  { transform: translateY(-6px) scale(1.10, 0.92) rotate(2deg); }
          56%  { transform: translateY(3px)  scale(0.96, 1.04) rotate(-1deg); }
          100% { transform: translateY(0)    scale(1.00, 1.00) rotate(0deg); }
        }
        .title-pop { animation: qz-pulse 680ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }

        /* Countdown pops */
        @keyframes qz-pop {
          0%   { transform: translateY(0)  scale(0.6, 1.35) rotate(-8deg); }
          28%  { transform: translateY(-10px) scale(1.28, 0.85) rotate(4deg); }
          52%  { transform: translateY(6px)   scale(0.93, 1.07) rotate(-2deg); }
          74%  { transform: translateY(-4px)  scale(1.1, 0.96)  rotate(1deg); }
          100% { transform: translateY(0)     scale(1, 1)      rotate(0); }
        }
        @keyframes qz-pop-go {
          0%   { transform: translateY(0)  scale(0.55, 1.45) rotate(-10deg); }
          24%  { transform: translateY(-16px) scale(1.38, 0.8) rotate(6deg); }
          48%  { transform: translateY(8px)   scale(0.9, 1.1)  rotate(-3deg); }
          72%  { transform: translateY(-6px)  scale(1.18, 0.95) rotate(2deg); }
          100% { transform: translateY(0)     scale(1.04, 1)    rotate(0); }
        }
        .pop    { animation: qz-pop    720ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .go-pop { animation: qz-pop-go 880ms cubic-bezier(0.2, 0.95, 0.15, 1) both; }

        @media (prefers-reduced-motion: reduce) {
          .pop, .go-pop, .title-pop, .qz-jitter, .fade-in, .fade-out, .fade-in-up { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
