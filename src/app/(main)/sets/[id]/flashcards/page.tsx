// /src/app/(main)/sets/[id]/flashcards/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Particles from "@/components/Particles";
import BlurText from "@/components/BlurText";
import SvgFileIcon from "@/components/SvgFileIcon";
import { motion, AnimatePresence } from "framer-motion";
import type { TargetAndTransition } from "framer-motion";


/* ──────────────────────────────────────────────────────────────────────────
   Types & constants
────────────────────────────────────────────────────────────────────────── */
type Difficulty = "easy" | "medium" | "hard";
const DIFF_TO_SECONDS: Record<Difficulty, number> = { easy: 30, medium: 20, hard: 10 };
const DIFF_TO_POINTS: Record<Difficulty, number> = { easy: 5, medium: 10, hard: 20 };
const STORAGE_PREFIX = "qz_flashcards_prefs_";

type Term = { id: string; front: string; back: string };
type InEvent = { cardId: string; correct: boolean; timeMs?: number | null };


// Demo fallback (used only for scope=all on failure/empty)
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
  value, places = 2, fontSize = 48, gap = 6, textColor = "white", fontWeight = 900, padding = 0,
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
  const ASPECT = BASE_H / BASE_W;
  const [size, setSize] = useState<{ width: number; height: number }>({ width: BASE_W * TARGET_SCALE, height: BASE_H * TARGET_SCALE });
  useEffect(() => {
    function recalc() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const padX = 64;   // side padding
      const padY = 260;  // room for HUD/actions
      const maxW = Math.min(BASE_W * TARGET_SCALE, vw - padX);
      const maxH = Math.min(BASE_H * TARGET_SCALE, vh - padY);
      const width = Math.min(maxW, Math.floor(maxH / ASPECT));
      const height = Math.floor(width * ASPECT);
      setSize({ width: Math.max(320, width), height: Math.max(200, height) });
    }
    recalc(); window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);
  return size;
}

/* ──────────────────────────────────────────────────────────────────────────
   BKT-based next review helpers (inline: no extra file needed)
────────────────────────────────────────────────────────────────────────── */
type SkillMastery = {
  skillId: string;
  skillName: string;
  pKnow: number;          // 0..1
  lastReviewedAt: string; // ISO
  streak?: number;
};
type SkillNextReview = {
  skillId: string;
  skillName: string;
  pKnow: number;
  nextReviewAt: string;   // ISO
  intervalDays: number;
};

function intervalDaysFor(pKnow: number, streak = 0): number {
  let base =
    pKnow < 0.60 ? 1 :
    pKnow < 0.75 ? 2 :
    pKnow < 0.85 ? 4 :
    pKnow < 0.95 ? 7 : 14;
  if (pKnow >= 0.95) base += Math.min(streak, 8) * 2; // +2/day per streak step, capped
  return Math.min(base, 45);
}
function computeNextReviews(skills: SkillMastery[]): SkillNextReview[] {
  return skills.map((m) => {
    const days = intervalDaysFor(m.pKnow, m.streak ?? 0);
    const last = new Date(m.lastReviewedAt);
    const base = isNaN(last.getTime()) ? new Date() : last;
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      skillId: m.skillId,
      skillName: m.skillName,
      pKnow: m.pKnow,
      intervalDays: days,
      nextReviewAt: next.toISOString(),
    };
  });
}
function formatDateLocal(iso: string): string {
  try { return new Date(iso).toLocaleString("en-PH", { hour12: true }); }
  catch { return iso; }
}

/* ──────────────────────────────────────────────────────────────────────────
   FlashcardDeck — faces rotate independently (no mirror) + glass look
   onSfx("correct" | "wrong", { byTimeout?: boolean })
────────────────────────────────────────────────────────────────────────── */
function FlashcardDeck({
  terms, difficulty, onScore, onLifeLost, onDeckProgress, onBurst, onPowerUp, onSfx, size, untimed,
  onAnswer, // ← add this
}: {
  terms: Term[]; difficulty: Difficulty; untimed: boolean;
  onScore: (pointsGained: number, newStreak: number) => void;
  onLifeLost: () => void;
  onDeckProgress: (cleared: number, total: number) => void;
  onBurst: (kind: "good" | "bad") => void;
  onPowerUp: (kind: "time" | "double" | "freeze") => void;
  onSfx: (kind: "correct" | "wrong", opts?: { byTimeout?: boolean }) => void;
  size: { width: number; height: number };
  onAnswer?: (cardId: string, correct: boolean, byTimeout?: boolean) => void; // ← add this
}) {
  const [order, setOrder] = useState<number[]>(() => terms.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [animState, setAnimState] = useState<"idle" | "right" | "left">("idle");
  const [cleared, setCleared] = useState(0);
  const [streak, setStreak] = useState(0);
  const [floatScore, setFloatScore] = useState<number | null>(null);

  useEffect(() => {
    setOrder(terms.map((_, i) => i));
    setFlipped(false); setAnimState("idle"); setCleared(0); setStreak(0);
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
    setFlipped(false);
    setAnimState("idle");
  }, []);

  const markCorrect = useCallback(() => {
    if (!top) return;
    setAnimState("right");
    onSfx("correct", { byTimeout: false });
    onAnswer?.(top.id, true, false);

    if (!untimed) {
      const points = Math.round(base * comboMultiplier);
      setTimeout(() => { setFloatScore(+points); setTimeout(() => setFloatScore(null), 700); }, 100);
      const newStreak = streak + 1; setStreak(newStreak); onScore(points, newStreak);
    }

    setCleared((c) => { const n = c + 1; onDeckProgress(n, total); return n; });
    onBurst("good");
    const roll = Math.random();
    if (roll < 0.06) onPowerUp("time"); else if (roll < 0.12) onPowerUp("freeze"); else if (roll < 0.18) onPowerUp("double");
    setTimeout(nextCard, 340);
  }, [top, base, comboMultiplier, streak, onScore, onDeckProgress, onBurst, onPowerUp, nextCard, total, onSfx, untimed]);

  const markIncorrect = useCallback((byTimeout: boolean = false) => {
    if (!top) return;
    setAnimState("left");
    onSfx("wrong", { byTimeout });
    onAnswer?.(top.id, false, byTimeout);

    if (!untimed) {
      setStreak(0); onLifeLost();
    }

    setCleared((c) => { const n = c + 1; onDeckProgress(n, total); return n; });
    onBurst("bad");
    setTimeout(nextCard, 340);
  }, [top, onLifeLost, onDeckProgress, total, nextCard, onSfx, onBurst, untimed]);

  // expose keyboard helpers
  useEffect(() => {
    (window as any).__qc = {
      correct: () => markCorrect(),
      wrong: (byTimeout?: boolean) => markIncorrect(Boolean(byTimeout)),
      flip: () => setFlipped((f: boolean) => !f),
      isFlipped: () => flipped,
    };
  }, [markCorrect, markIncorrect, flipped]);

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
          const animate: TargetAndTransition =
            isTop && animState === "right"
              ? { x: 320, rotate: 9, opacity: 0, transition: { duration: 0.32, ease: "easeInOut" as const } }
              : isTop && animState === "left"
              ? { x: -320, rotate: -9, opacity: 0, transition: { duration: 0.32, ease: "easeInOut" as const } }
              : { x: 0, rotate: 0, opacity: 1, transition: { duration: 0.26, ease: "easeOut" as const } };

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
                {/* Glass surface (static) */}
                <div
                  className="absolute inset-0 rounded-[28px] overflow-hidden ring-1 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,0.35)]"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07))",
                    borderColor: "rgba(168,177,255,0.28)",
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55), transparent)", opacity: 0.18 }} />
                  <div className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(1300px 800px at 10% -20%, rgba(168,177,255,0.45), transparent 60%)", opacity: 0.10 }} />
                </div>

                {/* STATIC overlay label (no fly-in/out) */}
                <div className="absolute left-5 top-4 text-xs tracking-wide uppercase text-white/70 pointer-events-none select-none">
                  {isTop && (flipped ? "DEFINITION" : "TERM")}
                </div>

                {/* Interaction layer (drag + click) */}
                <motion.div
                  className="absolute inset-0 cursor-pointer"
                  drag={isTop ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (!isTop) return;
                    if (info.offset.x > 160) { markCorrect(); return; }
                    if (info.offset.x < -160) { markIncorrect(false); return; }
                  }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => isTop && (window as any).__qc?.flip?.()}
                />

                {/* FRONT FACE */}
                <motion.div
                  initial={false}
                  className="absolute inset-0 grid place-items-center px-10"
                  style={{
                    transformOrigin: "center", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    transformStyle: "preserve-3d", willChange: "transform",
                  }}
                  animate={{ rotateY: flipped && isTop ? 180 : 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <div className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] text-center">
                    {terms[idx].front}
                  </div>
                </motion.div>

                {/* BACK FACE */}
                <motion.div
                  initial={false}
                  className="absolute inset-0 grid place-items-center px-10"
                  style={{
                    transformOrigin: "center", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    transformStyle: "preserve-3d", willChange: "transform",
                  }}
                  animate={{ rotateY: flipped && isTop ? 0 : -180 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <div className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] text-center">
                    {terms[idx].back}
                  </div>
                </motion.div>
              </div>

              {/* Points popup */}
              <AnimatePresence>
                {floatScore !== null && (
                  <motion.div
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[110%] text-white font-extrabold text-3xl"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: -2, scale: 1.06 }}
                    exit={{ opacity: 0, y: -16, scale: 0.98 }}
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
        {order.length > 0 && visible[0] !== undefined && flipped && (
          <motion.div
            className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
          >
            {/* Wrong (translucent RED) */}
            <button
              aria-label="Wrong"
              onClick={(e) => { e.stopPropagation(); markIncorrect(false); }}
              className="rounded-xl p-3 bg-[rgba(239,68,68,0.22)] hover:bg-[rgba(239,68,68,0.32)] active:scale-[0.98]
                        ring-1 ring-white/20 backdrop-blur-md transition-colors
                        shadow-[0_6px_20px_rgba(239,68,68,0.25)]"
            >
              <SvgFileIcon src="/icons/wrong.svg" className="h-6 w-6 opacity-90" />
            </button>

            {/* Correct (translucent GREEN) */}
            <button
              aria-label="Correct"
              onClick={(e) => { e.stopPropagation(); markCorrect(); }}
              className="rounded-xl p-3 bg-[rgba(31,139,76,0.22)] hover:bg-[rgba(31,139,76,0.32)] active:scale-[0.98]
                        ring-1 ring-white/20 backdrop-blur-md transition-colors
                        shadow-[0_6px_20px_rgba(31,139,76,0.25)]"
            >
              <SvgFileIcon src="/icons/correct.svg" className="h-6 w-6 opacity-90" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getUserId(): string | null {
  try {
    const raw = localStorage.getItem("qz_auth");
    if (!raw) return null;
    const js = JSON.parse(raw);
    return typeof js?.id === "string" ? js.id : null;
  } catch { return null; }
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
  const urlShuffle = search.get("shuffle");
  const urlUntimed = search.get("untimed");
  // scope determines whether we gate on recommendations
  const scope = (search.get("scope") as "all" | "recommended") || "all";

  const storageKey = useMemo(() => `${STORAGE_PREFIX}${setId}`, [setId]);
  const stored = useMemo(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [storageKey]);

  const difficulty: Difficulty = urlDiff || stored?.difficulty || "easy";
  const mute: boolean = urlMute === "1" ? true : urlMute === "0" ? false : Boolean(stored?.mute);
  const shuffle: boolean = urlShuffle === "1";
  const untimed: boolean = urlUntimed === "1";
  const initialSeconds = DIFF_TO_SECONDS[difficulty] ?? 30;

  // Phases
  const [phase, setPhase] = useState<"introText" | "countdown" | "running" | "summary">("introText");
  const [textFadingOut, setTextFadingOut] = useState(false);
  const [counterFadingOut, setCounterFadingOut] = useState(false);
  const [introCount, setIntroCount] = useState<number>(3);

  // Data (REAL set data with fallback for scope=all only)
  const [terms, setTerms] = useState<Term[]>([]);             // ← start empty (no early demo)
  const [loadingTerms, setLoadingTerms] = useState(true);

  // Recommended guard + next-review popup
  const [showEmptyPopup, setShowEmptyPopup] = useState(false);
  const [nextReviews, setNextReviews] = useState<SkillNextReview[]>([]);

  // Fetchers
  async function fetchSet(setId: string): Promise<any> {
    const res = await fetch(`/api/sets/${setId}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function fetchRecommendedIds(setId: string): Promise<string[]> {
  const userId = getUserId();
  const qs = new URLSearchParams();
  if (userId) qs.set("userId", userId);
  // keep any other query flags you want (e.g., scope) — they’re ignored server-side
  const res = await fetch(`/api/sets/${setId}/recommendations?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json() as { cardIds?: string[] };
  return Array.isArray(data.cardIds) ? data.cardIds : [];
}

  
  type StatsSkill = {
    skillId: string;
    skillName: string;
    pKnow: number;
    nextReviewAt: string | null;
  };
  type StatsPayload = { skills: StatsSkill[]; totals: { skills: number; mastered: number; nextDueAt: string | null } };

  type SkillNextReview = {
    skillId: string;
    skillName: string;
    pKnow: number;
    nextReviewAt: string;   // ISO
    intervalDays: number;   // not used by the popup; set 0
  };

  async function fetchStats(setId: string): Promise<{ nexts: SkillNextReview[] }> {
    const userId = getUserId();
    const res = await fetch(`/api/sets/${setId}/stats?userId=${encodeURIComponent(userId ?? "")}`, { cache: "no-store" });
    if (!res.ok) return { nexts: [] };

    const data: StatsPayload = await res.json();
    const nexts: SkillNextReview[] = (data.skills ?? [])
      .filter(s => !!s.nextReviewAt)
      .map(s => ({
        skillId: s.skillId,
        skillName: s.skillName,
        pKnow: s.pKnow,
        nextReviewAt: s.nextReviewAt as string,
        intervalDays: 0,
      }));

    return { nexts };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTerms(true);
      try {
        const [setData, stats] = await Promise.all([fetchSet(setId), fetchStats(setId)]);
        if (cancelled) return;

        // Compute next reviews for popup
        setNextReviews(stats.nexts || []);

        // Map cards → terms
        let mapped: Term[] = Array.isArray(setData?.cards)
          ? (setData.cards as any[]).map((c) => ({
              id: String(c?.id ?? crypto.randomUUID()),
              front: String(c?.term ?? ""),
              back: String(c?.definition ?? ""),
            }))
          : [];

        if (scope === "all") {
          if (shuffle && mapped.length > 1) {
            for (let i = mapped.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
            }
          }
          setTerms(mapped.length ? mapped : DEMO_TERMS); // demo fallback only for ALL
          setShowEmptyPopup(false);
        } else {
          // scope === "recommended"
          const ids = await fetchRecommendedIds(setId);
          if (cancelled) return;

          if (!ids || ids.length === 0) {
            setTerms([]);              // ← no fallback
            setShowEmptyPopup(true);   // show popup instead
          } else {
            const dict = new Map(mapped.map(t => [t.id, t]));
            const filtered: Term[] = ids.map(id => dict.get(String(id))).filter(Boolean) as Term[];
            if (filtered.length === 0) {
              // ID mismatch or nothing matched → treat as empty recommended
              setTerms([]);
              setShowEmptyPopup(true);
            } else {
              setTerms(filtered);
              setShowEmptyPopup(false);
            }
          }
        }
      } catch (e) {
        // On error: NEVER fall back to demo when scope=recommended
        if (!cancelled) {
          if (scope === "recommended") {
            setTerms([]);
            setShowEmptyPopup(true);
          } else {
            setTerms(DEMO_TERMS);
            setShowEmptyPopup(false);
          }
        }
      } finally {
        if (!cancelled) setLoadingTerms(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [setId, scope, shuffle]);

  // Game state
  const [timeLeft, setTimeLeft] = useState<number>(initialSeconds);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [cleared, setCleared] = useState(0);
  const [frozenUntil, setFrozenUntil] = useState<number>(0);
  const [doubleUntil, setDoubleUntil] = useState<number>(0);
  const total = terms.length;

  // ── Step 3: Study events buffer → POST /api/study/events
const [evBuf, setEvBuf] = useState<InEvent[]>([]);

// called by the deck when a card is answered
const handleAnswer = useCallback((cardId: string, correct: boolean, _byTimeout?: boolean) => {
  setEvBuf((buf) => [...buf, { cardId, correct }]);
}, []);

// flush to the server; keepalive allows it to send during nav/unload
const flushEvents = useCallback(async () => {
  if (evBuf.length === 0) return;
  const userId = getUserId();
  try {
    await fetch("/api/study/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, setId, events: evBuf }),
      keepalive: true,
    });
  } catch {
    // ignore network failures; next flush will retry with new events
  }
  setEvBuf([]);
}, [evBuf, setId]);

// auto-flush if buffer grows
useEffect(() => {
  if (evBuf.length >= 10) void flushEvents();
}, [evBuf.length, flushEvents]);

// flush at end of session & on page unload
useEffect(() => {
  const onUnload = () => { void flushEvents(); };
  window.addEventListener("pagehide", onUnload);
  window.addEventListener("beforeunload", onUnload);
  return () => {
    window.removeEventListener("pagehide", onUnload);
    window.removeEventListener("beforeunload", onUnload);
  };
}, [flushEvents]);

useEffect(() => {
  if (phase === "summary") void flushEvents();
}, [phase, flushEvents]);

  // Dynamic particles color by urgency (untimed keeps a calm palette)
  const urgency = untimed ? 1 : Math.max(0, Math.min(1, timeLeft / initialSeconds || 0));
  const particleColor = urgencyColor(urgency);

  // Responsive card size
  const cardSize = useCardSize();

  /* ── Audio: BGM + SFX ─────────────────────────────────────────────────── */
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const triedAutoplayRef = useRef(false);
  const sfx = useRef<{ correct?: HTMLAudioElement; wrong?: HTMLAudioElement; timer?: HTMLAudioElement }>({});

  useEffect(() => {
    // background music
    bgmRef.current = typeof Audio !== "undefined" ? new Audio("/music/flashcards-bgm.mp3") : null;
    if (bgmRef.current) {
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.35;
    }
    // sfx
    if (typeof Audio !== "undefined") {
      sfx.current.correct = new Audio("/music/correct.mp3");
      sfx.current.wrong = new Audio("/music/wrong.mp3");
      sfx.current.timer = new Audio("/music/timer.mp3");
      if (sfx.current.correct) sfx.current.correct.volume = 0.55;
      if (sfx.current.wrong) sfx.current.wrong.volume = 0.55;
      if (sfx.current.timer) sfx.current.timer.volume = 0.75;
    }
    return () => {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.currentTime = 0; }
    };
  }, []);

  // Play correct/wrong EVEN in untimed; suppress only TIMER in untimed.
  const playSfx = useCallback((kind: "correct" | "wrong" | "timer") => {
    if (mute) return;
    if (untimed && kind === "timer") return; // no timer beep in untimed
    const el = sfx.current[kind];
    if (!el) return;
    try { el.currentTime = 0; void el.play(); } catch {}
  }, [mute, untimed]);

  // Stop (and rewind) a specific sfx
  const stopSfx = useCallback((kind: "correct" | "wrong" | "timer") => {
    const el = sfx.current[kind];
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {}
  }, []);

  // Start/stop bgm with phase (also stop timer beep when leaving running)
  useEffect(() => {
    if (!bgmRef.current) return;
    if (phase === "running" && !mute) {
      if (bgmRef.current.paused) {
        bgmRef.current.play().catch(() => {
          if (triedAutoplayRef.current) return;
          triedAutoplayRef.current = true;
          const onGesture = () => {
            bgmRef.current?.play().finally(() => {
              window.removeEventListener("pointerdown", onGesture);
              window.removeEventListener("keydown", onGesture);
            });
          };
          window.addEventListener("pointerdown", onGesture, { once: true });
          window.addEventListener("keydown", onGesture, { once: true });
        });
      }
    } else {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
      stopSfx("timer"); // ensure timer beep halts when leaving the game
    }
  }, [phase, mute, stopSfx]);

  // Welcome (5s) → countdown (freeze if popup is shown)
  useEffect(() => {
    if (phase !== "introText") return;
    if (showEmptyPopup) return; // block auto-advance when recommended is empty
    const showTimer = setTimeout(() => {
      setTextFadingOut(true);
      const fadeTimer = setTimeout(() => { setTextFadingOut(false); setPhase("countdown"); }, 550);
      return () => clearTimeout(fadeTimer);
    }, 5000);
    return () => clearTimeout(showTimer);
  }, [phase, showEmptyPopup]);

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

  // Per-card timer (disabled in untimed)
  const timeoutFiredRef = useRef(false);
  const warnPlayedRef = useRef(false);
  useEffect(() => {
    if (phase !== "running" || untimed) return;
    setTimeLeft(initialSeconds);
    timeoutFiredRef.current = false;
    warnPlayedRef.current = false;

    let t: ReturnType<typeof setInterval> | null = null;
    t = setInterval(() => {
      if (Date.now() < frozenUntil) return;
      setTimeLeft((s) => {
        const next = s > 0 ? s - 1 : 0;
        if (next === 5 && !warnPlayedRef.current) {
          warnPlayedRef.current = true;
          playSfx("timer"); // play once per card
        }
        if (next > 0) return next;
        // timeout → mark wrong once (flag as byTimeout = true)
        if (!timeoutFiredRef.current) {
          timeoutFiredRef.current = true;
          (window as any).__qc?.wrong?.(true);
        }
        return 0;
      });
    }, 1000);

    // cleanup: stop interval + kill any timer beep when the whole timer effect unmounts
    return () => {
      if (t) clearInterval(t);
      stopSfx("timer");
    };
  }, [phase, initialSeconds, frozenUntil, playSfx, stopSfx, untimed]);

  // Reset timer on deck progress (new card). Do NOT forcibly stop timer.mp3 here.
  useEffect(() => {
    if (phase !== "running" || untimed) return;
    setTimeLeft(initialSeconds);
    timeoutFiredRef.current = false;
    warnPlayedRef.current = false;
  }, [cleared, initialSeconds, phase, untimed]);

  // End states
  useEffect(() => {
    if (phase !== "running") return;
    if ((!untimed && lives <= 0) || cleared >= total) {
      setTimeout(() => setPhase("summary"), 350);
    }
  }, [phase, lives, cleared, total, untimed]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "running") return;
      const api = (window as any).__qc;
      const isFlipped = api?.isFlipped?.();

      if (e.key === "ArrowRight") {
        if (isFlipped) { e.preventDefault(); api?.correct?.(); }
        return;
      }
      if (e.key === "ArrowLeft") {
        if (isFlipped) { e.preventDefault(); api?.wrong?.(false); }
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        api?.flip?.();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Deck handlers (stop timer beep only if NOT a timeout)
  const handleScore = useCallback((points: number, newStreak: number) => {
    if (untimed) return;
    const now = Date.now(); const mul = now < doubleUntil ? 2 : 1;
    setScore((s) => s + points * mul); setStreak(newStreak);
  }, [doubleUntil, untimed]);
  const handleLifeLost = useCallback(() => {
    if (untimed) return;
    setLives((l) => Math.max(0, l - 1)); setStreak(0);
  }, [untimed]);
  const handleDeckProgress = useCallback((nCleared: number) => { setCleared(nCleared); }, []);
  const handleSfxFromDeck = useCallback((kind: "correct" | "wrong", opts?: { byTimeout?: boolean }) => {
    if (!opts?.byTimeout) stopSfx("timer"); // user-initiated answer: kill the timer beep immediately
    playSfx(kind);                           // play correct/wrong SFX even in untimed
  }, [playSfx, stopSfx]);

  const [burstKey, setBurstKey] = useState(0);
  const [burstKind, setBurstKind] = useState<"good" | "bad">("good");
  const triggerBurst = useCallback((kind: "good" | "bad") => {
    setBurstKind(kind);
    setBurstKey((k) => k + 1);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const triggerPowerUp = useCallback((kind: "time" | "double" | "freeze") => {
    if (untimed) return; // no powerups in untimed
    const now = Date.now();
    if (kind === "time") { setTimeLeft((s) => s + 5); setToast("+5s Time Boost"); }
    else if (kind === "freeze") { setFrozenUntil(now + 3000); setToast("⏸ Timer Frozen (3s)"); }
    else if (kind === "double") { setDoubleUntil(now + 8000); setToast("✖2 Double Points (8s)"); }
    setTimeout(() => setToast(null), 1800);
  }, [untimed]);

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

      {/* Stronger radial burst when scoring/miss */}
      <AnimatePresence key={burstKey}>
        <motion.div
          key={`burst-${burstKey}`}
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            background:
              burstKind === "good"
                ? "radial-gradient(800px circle at center, rgba(16,185,129,0.40), transparent 58%), radial-gradient(1400px circle at center, rgba(16,185,129,0.18), transparent 70%)"
                : "radial-gradient(800px circle at center, rgba(239,68,68,0.45), transparent 58%), radial-gradient(1400px circle at center, rgba(239,68,68,0.20), transparent 70%)",
          }}
        />
      </AnimatePresence>

      {/* Foreground stage */}
      <div className="relative z-10 h-full w-full">
        {/* Recommended guard popup */}
        {showEmptyPopup && (
          <div className="absolute inset-0 grid place-items-center p-4 backdrop-blur-sm bg-black/40">
            <div className="w-[min(560px,92vw)] rounded-2xl bg-[#18062e] ring-1 ring-white/15 p-6 text-white">
              <div className="text-xl font-semibold mb-1">Nothing to review right now</div>
              <p className="text-sm text-white/80">
                Your recommended pool is empty. Here are the next review times per skill:
              </p>

              <div className="mt-4 space-y-2">
                {nextReviews.length > 0 ? nextReviews.map((r) => (
                  <div key={r.skillId} className="flex items-center justify-between rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2">
                    <span className="text-white/90">{r.skillName}</span>
                    <span className="text-white/70">{formatDateLocal(r.nextReviewAt)}</span>
                  </div>
                )) : (
                  <div className="rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-white/70">
                    No skill mastery data yet.
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <a
                  href={`/sets/${setId}/flashcards?difficulty=${difficulty}${mute ? "&mute=1" : "&mute=0"}${untimed ? "&untimed=1" : ""}&scope=all`}
                  className="rounded-md px-3 py-1.5 text-sm text-white/90 bg-[#532e95] hover:bg-[#5f3aa6] ring-1 ring-white/20"
                >
                  Study all terms instead
                </a>
                <a
                  href={`/sets/${setId}/statistics`}
                  className="rounded-md px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10"
                >
                  View stats
                </a>
                <a
                  href="/library"
                  className="rounded-md px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10"
                >
                  Back to set
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Welcome (5s) */}
        {phase === "introText" && !showEmptyPopup && (
          <div className="absolute inset-0 grid place-items-center p-4 backdrop-blur-sm bg-black/30">
            <div className={["transition-opacity duration-500", textFadingOut ? "opacity-0" : "opacity-100"].join(" ")}>
              <BlurText
                text={loadingTerms ? "Loading set..." : "Welcome to Flashcards"}
                delay={200} animateBy="words" direction="top"
                onAnimationComplete={() => {}} className="text-white text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 text-center"
              />
            </div>
          </div>
        )}

        {/* Step 2: 3-2-1 (1s each) */}
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

            {/* HUD row (hidden in untimed) */}
            {!untimed && (
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
            )}

            {/* Timer (top-right) — hidden in untimed; pulses red at ≤5s */}
            {!untimed && (
              <div className={`absolute top-10 right-4 ${timeLeft <= 5 ? "animate-pulse" : ""}`}>
                <AnimatedCounter
                  value={timeLeft}
                  places={2}
                  fontSize={32}
                  padding={0}
                  gap={4}
                  textColor={timeLeft <= 5 ? "#ff4747" : "white"}
                  fontWeight={900}
                />
              </div>
            )}

            {/* Streak glow line when hot (hidden in untimed) */}
            {!untimed && (
              <AnimatePresence>
                {streak >= 5 && (
                  <motion.div
                    key="streak-glow" className="pointer-events-none absolute top-[6px] left-0 right-0 h-1"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ background: "linear-gradient(90deg, transparent, #a8b1ff, white, #a8b1ff, transparent)" }}
                  />
                )}
              </AnimatePresence>
            )}

            {/* Power-up toast (hidden in untimed) */}
            {!untimed && (
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
            )}

            {/* Deck */}
            <div className="h-full w-full grid place-items-center p-4">
              <FlashcardDeck
                terms={terms}
                difficulty={difficulty}
                untimed={untimed}
                onScore={(p, s) => handleScore(p, s)}
                onLifeLost={handleLifeLost}
                onDeckProgress={(n) => handleDeckProgress(n)}
                onBurst={(k) => triggerBurst(k)}
                onPowerUp={(k) => triggerPowerUp(k)}
                onSfx={handleSfxFromDeck}
                size={cardSize}
                onAnswer={handleAnswer}
              />
            </div>
          </>
        )}

        {/* Summary */}
        {phase === "summary" && (
          <div className="absolute inset-0 grid place-items-center p-4 backdrop-blur-sm bg-black/40">
            <div className="w-[min(560px,92vw)] rounded-2xl bg-[#18062e] ring-1 ring-white/15 p-6 text-white">
              <div className="text-xl font-semibold">Session Summary</div>

              {/* Stats grid (hide score/streak in untimed) */}
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-white/70">Difficulty</div>
                  <div className="text-white font-medium capitalize">{difficulty}</div>
                </div>
                {!untimed && (
                  <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3">
                    <div className="text-white/70">Score</div>
                    <div className="text-white font-medium">{score}</div>
                  </div>
                )}
                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-white/70">Cleared</div>
                  <div className="text-white font-medium">{Math.min(cleared, terms.length)} / {terms.length}</div>
                </div>
                {!untimed && (
                  <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3">
                    <div className="text-white/70">Max Streak</div>
                    <div className="text-white font-medium">{streak}</div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <a
                  href={`/sets/${setId}/flashcards?difficulty=${difficulty}${mute ? "&mute=1" : "&mute=0"}${shuffle ? "&shuffle=1" : ""}${untimed ? "&untimed=1" : ""}${scope ? `&scope=${scope}` : ""}`}
                  className="rounded-md px-3 py-1.5 text-sm text-white/90 bg-[#532e95] hover:bg-[#5f3aa6] ring-1 ring-white/20"
                >
                  Play again
                </a>
                <a
                  href={`/sets/${setId}/statistics`}
                  className="rounded-md px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10"
                >
                  View stats
                </a>
                <a
                  href="/library"
                  className="rounded-md px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10"
                >
                  Back to set
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
