"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Particles from "@/components/Particles";
import BlurText from "@/components/BlurText";
import SvgFileIcon from "@/components/SvgFileIcon";
import { motion, AnimatePresence } from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────────
   Types & constants
────────────────────────────────────────────────────────────────────────── */
type Difficulty = "easy" | "medium" | "hard";
const DIFF_TO_SECONDS: Record<Difficulty, number> = { easy: 30, medium: 20, hard: 10 };
const DIFF_TO_POINTS: Record<Difficulty, number> = { easy: 5, medium: 10, hard: 20 };
const STORAGE_PREFIX = "qz_flashcards_prefs_";

type Term = { id: string; front: string; back: string };

// Demo data — replace with real set terms later
const DEMO_TERMS: Term[] = [
  { id: "1", front: "Mitochondria — function?", back: "Powerhouse of the cell (ATP generation)" },
  { id: "2", front: "Photosynthesis formula", back: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂" },
  { id: "3", front: "Newton’s 2nd Law", back: "F = m · a" },
  { id: "4", front: "Capital of Japan", back: "Tokyo" },
  { id: "5", front: "Largest planet", back: "Jupiter" },
];

/* ──────────────────────────────────────────────────────────────────────────
   AnimatedCounter — per-digit slide counter
────────────────────────────────────────────────────────────────────────── */
function padNumber(value: number, places: number) {
  const s = Math.max(0, value).toString();
  if (s.length >= places) return s.slice(-places);
  return "0".repeat(places - s.length) + s;
}
function AnimatedCounter({
  value,
  places = 2,
  fontSize = 48,
  gap = 6,
  textColor = "white",
  fontWeight = 900,
  padding = 0,
}: {
  value: number; places?: number; fontSize?: number; gap?: number; textColor?: string; fontWeight?: number; padding?: number;
}) {
  const str = padNumber(value, places);
  return (
    <div className="flex items-center justify-center" style={{ gap, padding }} aria-label={`counter-${value}`}>
      {Array.from(str).map((ch, i) => (
        <div key={`slot-${i}`} className="relative overflow-hidden" style={{ height: fontSize * 1.25, minWidth: fontSize * 0.6 }} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={`${i}-${ch}`}
              initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute left-1/2 -translate-x-1/2"
              style={{ fontSize, fontWeight, color: textColor, lineHeight: 1.1, whiteSpace: "pre" }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Utility: color ramp for urgency (timeLeft ratio → color)
────────────────────────────────────────────────────────────────────────── */
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function urgencyColor(t: number) {
  const clamp = Math.max(0, Math.min(1, t));
  if (clamp > 0.5) {
    const tt = (clamp - 0.5) / 0.5;
    const r = Math.round(lerp(255, 80, tt));
    const g = Math.round(lerp(255, 200, tt));
    const b = Math.round(lerp(255, 80, tt));
    return `rgb(${r},${g},${b})`;
  }
  const tt = clamp / 0.5;
  const r = 255;
  const g = Math.round(lerp(80, 200, tt));
  const b = 80;
  return `rgb(${r},${g},${b})`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Responsive card sizing (~3×, clamped to viewport)
────────────────────────────────────────────────────────────────────────── */
function useCardSize() {
  const BASE_W = 460, BASE_H = 280, TARGET_SCALE = 3;
  const ASPECT = BASE_H / BASE_W; // ~0.6087
  const [size, setSize] = useState<{ width: number; height: number }>({ width: BASE_W * TARGET_SCALE, height: BASE_H * TARGET_SCALE });

  useEffect(() => {
    function recalc() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const padX = 64;           // side padding
      const padY = 260;          // leave space for HUD/actions
      const maxW = Math.min(BASE_W * TARGET_SCALE, vw - padX);
      const maxH = Math.min(BASE_H * TARGET_SCALE, vh - padY);
      const width = Math.min(maxW, Math.floor(maxH / ASPECT));
      const height = Math.floor(width * ASPECT);
      setSize({ width: Math.max(320, width), height: Math.max(200, height) });
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);
  return size;
}

/* ──────────────────────────────────────────────────────────────────────────
   FlashcardDeck — faces rotate independently (no mirror bug) + glass look
────────────────────────────────────────────────────────────────────────── */
function FlashcardDeck({
  terms, difficulty, onScore, onLifeLost, onDeckProgress, onBurst, onPowerUp, size,
}: {
  terms: Term[]; difficulty: Difficulty;
  onScore: (pointsGained: number, newStreak: number) => void;
  onLifeLost: () => void;
  onDeckProgress: (cleared: number, total: number) => void;
  onBurst: (kind: "good" | "bad") => void;
  onPowerUp: (kind: "time" | "double" | "freeze") => void;
  size: { width: number; height: number };
}) {
  const [order, setOrder] = useState<number[]>(() => terms.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [animState, setAnimState] = useState<"idle" | "right" | "left">("idle");
  const [cleared, setCleared] = useState(0);
  const [streak, setStreak] = useState(0);
  const [floatScore, setFloatScore] = useState<number | null>(null);

  useEffect(() => {
    setOrder(terms.map((_, i) => i));
    setFlipped(false); setAnimState("idle");
    setCleared(0); setStreak(0);
  }, [terms]);

  const total = terms.length;
  const topIdx = order[0] ?? 0;
  const top = terms[topIdx];

  const base = DIFF_TO_POINTS[difficulty];
  const comboMultiplier = Math.min(2, 1 + streak * 0.05);

  const nextCard = useCallback(() => {
    setOrder((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev; return [...rest, first];
    });
    setFlipped(false); setAnimState("idle");
  }, []);

  const markCorrect = useCallback(() => {
    if (!top) return;
    setAnimState("right");
    const points = Math.round(base * comboMultiplier);
    setTimeout(() => { setFloatScore(+points); setTimeout(() => setFloatScore(null), 700); }, 100);
    const newStreak = streak + 1; setStreak(newStreak); onScore(points, newStreak);
    setCleared((c) => { const n = c + 1; onDeckProgress(n, total); return n; });
    onBurst("good");
    const roll = Math.random();
    if (roll < 0.06) onPowerUp("time"); else if (roll < 0.12) onPowerUp("freeze"); else if (roll < 0.18) onPowerUp("double");
    setTimeout(nextCard, 340);
  }, [top, base, comboMultiplier, streak, onScore, onDeckProgress, onBurst, onPowerUp, total, nextCard]);

  const markIncorrect = useCallback(() => {
    if (!top) return;
    setAnimState("left"); setStreak(0); onLifeLost();
    setCleared((c) => { const n = c + 1; onDeckProgress(n, total); return n; });
    onBurst("bad");
    setTimeout(nextCard, 340);
  }, [top, onLifeLost, onDeckProgress, total, nextCard]);

  // expose keyboard helpers
  useEffect(() => {
    (window as any).__qc = { correct: () => markCorrect(), wrong: () => markIncorrect(), flip: () => setFlipped((f: boolean) => !f) };
  }, [markCorrect, markIncorrect]);

  const visible = order.slice(0, Math.min(3, order.length));
  const layers = [
    { scale: 1, y: 0, shadow: "shadow-xl", z: 30 },
    { scale: 0.985, y: 14, shadow: "shadow-lg", z: 20 },
    { scale: 0.97, y: 24, shadow: "shadow", z: 10 },
  ];

  return (
    <div className="relative" style={{ width: size.width, height: size.height }}>
      <AnimatePresence initial={false}>
        {visible.map((idx, i) => {
          const layer = layers[i] ?? layers[layers.length - 1];
          const isTop = i === 0;
          const animate =
            isTop && animState === "right"
              ? { x: 320, rotate: 9, opacity: 0, transition: { duration: 0.32, ease: "easeInOut" } }
              : isTop && animState === "left"
              ? { x: -320, rotate: -9, opacity: 0, transition: { duration: 0.32, ease: "easeInOut" } }
              : { x: 0, rotate: 0, opacity: 1, transition: { duration: 0.26, ease: "easeOut" } };

          return (
            <motion.div
              key={`${terms[idx].id}:${idx}`}
              className={`absolute inset-0 grid place-items-center ${layer.shadow}`}
              style={{ zIndex: layer.z }}
              initial={{ scale: layer.scale, y: layer.y, x: 0, rotate: 0, opacity: 1 }}
              animate={animate}
              exit={{ opacity: 0 }}
            >
              {/* Perspective context */}
              <div className="relative w-full h-full select-none" style={{ perspective: 1000 }}>
                {/* Glass surface (static, clips overlays) */}
                <div
                  className="absolute inset-0 rounded-[28px] overflow-hidden ring-1 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.35)]"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07))",
                    borderColor: "rgba(168,177,255,0.28)",
                  }}
                >
                  {/* sheen + vignette */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55), transparent)", opacity: 0.18 }} />
                  <div className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(1300px 800px at 10% -20%, rgba(168,177,255,0.45), transparent 60%)", opacity: 0.10 }} />
                </div>

                {/* Interaction layer (drag + click). We DO NOT rotate this layer. */}
                <motion.div
                  className="absolute inset-0 cursor-pointer"
                  drag={isTop ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (!isTop) return;
                    if (info.offset.x > 160) { markCorrect(); return; }
                    if (info.offset.x < -160) { markIncorrect(); return; }
                  }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => isTop && setFlipped((f) => !f)}
                />

                {/* FRONT FACE */}
                <motion.div
                  className="absolute inset-0 grid place-items-center px-10"
                  style={{
                    transformOrigin: "center", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    transformStyle: "preserve-3d", willChange: "transform",
                  }}
                  animate={{ rotateY: flipped && isTop ? 180 : 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <div className="absolute left-5 top-4 text-xs tracking-wide uppercase text-white/70">FRONT</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] text-center">
                    {terms[idx].front}
                  </div>
                </motion.div>

                {/* BACK FACE (counter-animated) */}
                <motion.div
                  className="absolute inset-0 grid place-items-center px-10"
                  style={{
                    transformOrigin: "center", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    transformStyle: "preserve-3d", willChange: "transform",
                  }}
                  animate={{ rotateY: flipped && isTop ? 0 : -180 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <div className="absolute left-5 top-4 text-xs tracking-wide uppercase text-white/70">BACK</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] text-center">
                    {terms[idx].back}
                  </div>
                </motion.div>
              </div>

              {/* Floating score popup */}
              <AnimatePresence>
                {floatScore !== null && (
                  <motion.div
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-10 text-white font-bold text-2xl"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: -14 }} exit={{ opacity: 0, y: -24 }}
                    transition={{ duration: 0.6 }}
                  >
                    {floatScore > 0 ? `+${floatScore}` : `${floatScore}`}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Actions: only when the top card is flipped */}
      <AnimatePresence>
        {order.length > 0 && flipped && (
          <motion.div
            className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            {/* Wrong (icon-only, RED) */}
            <button
              aria-label="Wrong"
              onClick={(e) => { e.stopPropagation(); markIncorrect(); }}
              className="rounded-xl p-3 bg-[#ef4444] hover:bg-[#f05252] active:scale-[0.98]
                        ring-1 ring-white/10 transition shadow-[0_6px_20px_rgba(239,68,68,0.35)]"
            >
              <SvgFileIcon src="/icons/wrong.svg" className="h-6 w-6" />
            </button>

            {/* Correct (icon-only, GREEN) */}
            <button
              aria-label="Correct"
              onClick={(e) => { e.stopPropagation(); markCorrect(); }}
              className="rounded-xl p-3 bg-[#1f8b4c] hover:bg-[#229b55] active:scale-[0.98]
                        ring-1 ring-white/10 transition shadow-[0_6px_20px_rgba(31,139,76,0.35)]"
            >
              <SvgFileIcon src="/icons/correct.svg" className="h-6 w-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
────────────────────────────────────────────────────────────────────────── */
export default function FlashcardsPage() {
  const { id: setId } = useParams<{ id: string }>();
  const search = useSearchParams();

  // Settings from URL or localStorage (fallback)
  const urlDiff = (search.get("difficulty") as Difficulty) || undefined;
  const urlMute = search.get("mute");
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${setId}`, [setId]);

  const stored = useMemo(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [storageKey]);

  const difficulty: Difficulty = urlDiff || stored?.difficulty || "easy";
  const mute: boolean = urlMute === "1" ? true : urlMute === "0" ? false : Boolean(stored?.mute);
  const initialSeconds = DIFF_TO_SECONDS[difficulty] ?? 30;

  // Phases
  const [phase, setPhase] = useState<"introText" | "countdown" | "running" | "summary">("introText");
  const [textFadingOut, setTextFadingOut] = useState(false);
  const [counterFadingOut, setCounterFadingOut] = useState(false);
  const [introCount, setIntroCount] = useState<number>(3);

  // Game state
  const [timeLeft, setTimeLeft] = useState<number>(initialSeconds);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [cleared, setCleared] = useState(0);
  const [frozenUntil, setFrozenUntil] = useState<number>(0);
  const [doubleUntil, setDoubleUntil] = useState<number>(0);
  const total = DEMO_TERMS.length;

  // Dynamic particles color by urgency
  const urgency = Math.max(0, Math.min(1, timeLeft / initialSeconds || 0));
  const particleColor = urgencyColor(urgency);

  // Responsive card size (~3x)
  const cardSize = useCardSize();

  /* ── BGM: play on game start (phase === "running"), respect mute ───────── */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTriedRef = useRef(false);
  useEffect(() => {
    audioRef.current = typeof Audio !== "undefined" ? new Audio("/music/flashcards-bgm.mp3") : null;
    if (audioRef.current) { audioRef.current.loop = true; audioRef.current.volume = 0.35; }
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } };
  }, []);
  const tryPlay = useCallback(() => {
    if (!audioRef.current || mute) return;
    const a = audioRef.current;
    a.play().catch(() => {
      if (audioTriedRef.current) return;
      audioTriedRef.current = true;
      const onGesture = () => {
        a.play().finally(() => {
          window.removeEventListener("pointerdown", onGesture);
          window.removeEventListener("keydown", onGesture);
        });
      };
      window.addEventListener("pointerdown", onGesture, { once: true });
      window.addEventListener("keydown", onGesture, { once: true });
    });
  }, [mute]);
  useEffect(() => {
    if (!audioRef.current) return;
    if (phase === "running" && !mute) { tryPlay(); }
    else { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  }, [phase, mute, tryPlay]);

  // Welcome (5s) → countdown
  useEffect(() => {
    if (phase !== "introText") return;
    const showTimer = setTimeout(() => {
      setTextFadingOut(true);
      const fadeTimer = setTimeout(() => { setPhase("countdown"); setTextFadingOut(false); }, 550);
      return () => clearTimeout(fadeTimer);
    }, 5000);
    return () => clearTimeout(showTimer);
  }, [phase]);

  // 3-2-1 → running
  useEffect(() => {
    if (phase !== "countdown") return;
    setIntroCount(3);
    let t: ReturnType<typeof setInterval> | null = null;
    t = setInterval(() => {
      setIntroCount((prev) => {
        if (prev > 1) return prev - 1;
        if (t) clearInterval(t);
        setCounterFadingOut(true);
        setTimeout(() => { setCounterFadingOut(false); setPhase("running"); }, 550);
        return prev;
      });
    }, 1000);
    return () => t && clearInterval(t);
  }, [phase]);

  // Timer tick (per-card). On timeout, auto-mark wrong via deck API.
  const timeoutFiredRef = useRef(false);
  useEffect(() => {
    if (phase !== "running") return;
    setTimeLeft(initialSeconds); // when entering running, start fresh
    timeoutFiredRef.current = false;
    let t: ReturnType<typeof setInterval> | null = null;
    t = setInterval(() => {
      if (Date.now() < frozenUntil) return;
      setTimeLeft((s) => {
        if (s > 1) return s - 1;
        if (!timeoutFiredRef.current) {
          timeoutFiredRef.current = true;
          (window as any).__qc?.wrong?.(); // advance with "Wrong"
        }
        return 0;
      });
    }, 1000);
    return () => t && clearInterval(t);
  }, [phase, initialSeconds, frozenUntil]);

  // Reset timer whenever the deck advances (correct/wrong) — uses onDeckProgress
  useEffect(() => {
    if (phase !== "running") return;
    setTimeLeft(initialSeconds);
    timeoutFiredRef.current = false;
  }, [cleared, initialSeconds, phase]);

  // End states
  useEffect(() => {
    if (phase !== "running") return;
    if (lives <= 0 || cleared >= total) {
      setTimeout(() => setPhase("summary"), 350);
    }
  }, [phase, lives, cleared, total]);

  // Keyboard shortcuts: Left = wrong, Right = correct, F = flip
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "running") return;
      if (e.key === "ArrowRight") { e.preventDefault(); (window as any).__qc?.correct?.(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); (window as any).__qc?.wrong?.(); }
      if (e.key.toLowerCase() === "f") { e.preventDefault(); (window as any).__qc?.flip?.(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Handlers passed to deck
  const handleScore = useCallback((points: number, newStreak: number) => {
    const now = Date.now(); const mul = now < doubleUntil ? 2 : 1;
    setScore((s) => s + points * mul); setStreak(newStreak);
  }, [doubleUntil]);
  const handleLifeLost = useCallback(() => { setLives((l) => Math.max(0, l - 1)); setStreak(0); }, []);
  const handleDeckProgress = useCallback((nCleared: number) => { setCleared(nCleared); }, []);

  const [burstKey, setBurstKey] = useState(0);
  const [burstKind, setBurstKind] = useState<"good" | "bad">("good");
  const triggerBurst = useCallback((kind: "good" | "bad") => { setBurstKind(kind); setBurstKey((k) => k + 1); }, []);

  const [toast, setToast] = useState<string | null>(null);
  const triggerPowerUp = useCallback((kind: "time" | "double" | "freeze") => {
    const now = Date.now();
    if (kind === "time") { setTimeLeft((s) => s + 5); setToast("+5s Time Boost"); }
    else if (kind === "freeze") { setFrozenUntil(now + 3000); setToast("⏸ Timer Frozen (3s)"); }
    else if (kind === "double") { setDoubleUntil(now + 8000); setToast("✖2 Double Points (8s)"); }
    setTimeout(() => setToast(null), 1800);
  }, []);

  return (
    <main className="fixed inset-0 z-[100] overflow-hidden bg-[#090314]">
      {/* Particles background (color reacts to urgency) */}
      <div className="absolute inset-0" style={{ position: "absolute", width: "100%", height: "100%" }}>
        <Particles
          particleColors={[particleColor, "#ffffff"]}
          particleCount={200} particleSpread={10} speed={0.02}
          particleBaseSize={100} moveParticlesOnHover alphaParticles={false} disableRotation={false}
        />
      </div>

      {/* Tiny radial burst when scoring/miss */}
      <AnimatePresence key={burstKey}>
        <motion.div
          key={`burst-${burstKey}`} className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          style={{
            background:
              burstKind === "good"
                ? "radial-gradient(600px circle at center, rgba(16,185,129,0.18), transparent 60%)"
                : "radial-gradient(600px circle at center, rgba(239,68,68,0.22), transparent 60%)",
          }}
        />
      </AnimatePresence>

      {/* Foreground stage */}
      <div className="relative z-10 h-full w-full">
        {/* Step 1: Welcome */}
        {phase === "introText" && (
          <div className="absolute inset-0 grid place-items-center p-4 backdrop-blur-sm bg-black/30">
            <div className={["transition-opacity duration-500", textFadingOut ? "opacity-0" : "opacity-100"].join(" ")}>
              <BlurText
                text="Welcome to Flashcards" delay={200} animateBy="words" direction="top"
                onAnimationComplete={() => {}} className="text-white text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 text-center"
              />
            </div>
          </div>
        )}

        {/* Step 2: 3-2-1 */}
        {phase === "countdown" && (
          <div className="absolute inset-0 grid place-items-center p-4 backdrop-blur-sm bg-black/20">
            <div className={["transition-opacity duration-500", counterFadingOut ? "opacity-0" : "opacity-100"].join(" ")}>
              <AnimatedCounter value={introCount} places={1} fontSize={96} padding={8} gap={10} textColor="white" fontWeight={900} />
            </div>
          </div>
        )}

        {/* HUD (running) */}
        {phase === "running" && (
          <>
            {/* Topmost progress bar */}
            <div className="absolute top-0 left-4 right-4">
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/10 backdrop-blur">
                <div
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${(cleared / total) * 100}%`, background: "linear-gradient(90deg, rgba(168,177,255,0.85), rgba(255,255,255,0.9))" }}
                />
              </div>
            </div>

            {/* Push HUD row down so it never overlaps the progress bar */}
            <div className="absolute top-10 left-4 flex items-center gap-3 text-white">
              <div className="rounded-md px-2.5 py-1.5 text-sm bg-white/8 ring-1 ring-white/15 backdrop-blur">
                Score: <span className="font-bold">{score}</span>
              </div>
              <div className="rounded-md px-2.5 py-1.5 text-sm bg-white/8 ring-1 ring-white/15 backdrop-blur">
                Streak: <span className="font-bold">{streak}</span>
              </div>
              <div className="rounded-md px-2.5 py-1.5 text-sm bg-white/8 ring-1 ring-white/15 backdrop-blur">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={i < lives ? "text-[#ef4444]" : "text-white/30"}>♥</span>
                ))}
              </div>
            </div>

            {/* Timer (top-right) */}
            <div className="absolute top-10 right-4">
              <AnimatedCounter value={timeLeft} places={2} fontSize={32} padding={0} gap={4} textColor="white" fontWeight={900} />
            </div>

            {/* Streak glow line when hot */}
            <AnimatePresence>
              {streak >= 5 && (
                <motion.div
                  key="streak-glow" className="pointer-events-none absolute top-[6px] left-0 right-0 h-1"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ background: "linear-gradient(90deg, transparent, #a8b1ff, white, #a8b1ff, transparent)" }}
                />
              )}
            </AnimatePresence>

            {/* Power-up toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  className="absolute top-20 left-1/2 -translate-x-1/2 rounded-md px-3 py-1.5 text-sm text-white bg-white/10 ring-1 ring-white/20"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Deck */}
            <div className="h-full w-full grid place-items-center p-4">
              <FlashcardDeck
                terms={DEMO_TERMS}
                difficulty={difficulty}
                onScore={(p, s) => handleScore(p, s)}
                onLifeLost={handleLifeLost}
                onDeckProgress={(n) => handleDeckProgress(n)}
                onBurst={(k) => triggerBurst(k)}
                onPowerUp={(k) => triggerPowerUp(k)}
                size={cardSize}
              />
            </div>
          </>
        )}

        {/* Summary */}
        {phase === "summary" && (
          <div className="absolute inset-0 grid place-items-center p-4 backdrop-blur-sm bg-black/40">
            <div className="w-[min(560px,92vw)] rounded-2xl bg-[#18062e] ring-1 ring-white/15 p-6 text-white">
              <div className="text-xl font-semibold">Session Summary</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3"><div className="text-white/70">Difficulty</div><div className="text-white font-medium capitalize">{difficulty}</div></div>
                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3"><div className="text-white/70">Score</div><div className="text-white font-medium">{score}</div></div>
                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3"><div className="text-white/70">Cleared</div><div className="text-white font-medium">{Math.min(cleared, total)} / {total}</div></div>
                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3"><div className="text-white/70">Max Streak</div><div className="text-white font-medium">{streak}</div></div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <a href={`/sets/${setId}/flashcards?difficulty=${difficulty}&mute=${mute ? "1" : "0"}`} className="rounded-md px-3 py-1.5 text-sm text-white/90 bg-[#532e95] hover:bg-[#5f3aa6] ring-1 ring-white/20">Play again</a>
                <a href={`/sets/${setId}`} className="rounded-md px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10">Back to set</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
