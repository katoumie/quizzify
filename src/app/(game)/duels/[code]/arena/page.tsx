// src/app/(game)/duels/[code]/arena/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { continuum } from "@/app/fonts";
import ArenaBGM from "@/components/ArenaBGM";

/** --- Types --- */
type Card = { id: string; term: string; definition: string; skill?: string | null };
type StudySet = { id: string; title?: string; name?: string; cards: Card[] };
type DuelSessionLite = { id: string; code: string; setId: string; status?: string };
type Choice = { id: string; text: string; isCorrect: boolean };
type BuiltQ = { cardId: string; term: string; correctDefinition: string; choices: Choice[] };

/** --- Helpers --- */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickNDistractors(all: string[], correct: string, n: number): string[] {
  const pool = all.filter((d) => d !== correct);
  return shuffle(pool).slice(0, n);
}
function buildQuestions(cards: Card[]): BuiltQ[] {
  const defs = cards.map((c) => c.definition);
  return cards.map((c) => {
    const distractors = pickNDistractors(defs, c.definition, Math.min(3, Math.max(0, defs.length - 1)));
    const choices: Choice[] = shuffle(
      [
        { id: `c-${c.id}`, text: c.definition, isCorrect: true },
        ...distractors.map((d, idx) => ({ id: `d-${c.id}-${idx}`, text: d, isCorrect: false })),
      ].slice(0, 4)
    );
    return { cardId: c.id, term: c.term, correctDefinition: c.definition, choices };
  });
}

/** --- Chip --- */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[13px] leading-none text-white/85">
      {children}
    </span>
  );
}

/** --- Page --- */
export default function ArenaPage() {
  const { code } = useParams<{ code: string }>();
  const search = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<DuelSessionLite | null>(null);
  const [setData, setSetData] = useState<StudySet | null>(null);

  const [questions, setQuestions] = useState<BuiltQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  // Timer + timeout state
  const [timerSec, setTimerSec] = useState(10);
  const [timeoutReveal, setTimeoutReveal] = useState(false);

  const finished = idx >= questions.length;
  const current = !finished ? questions[idx] : undefined;

  /** Fetch helpers */
  async function loadSession(): Promise<DuelSessionLite | null> {
    const tryPaths = [`/api/duels/${code}`, `/api/duels/${code}/session`];
    for (const p of tryPaths) {
      try {
        const r = await fetch(p, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const s: DuelSessionLite = {
            id: j.id ?? j.session?.id,
            code: j.code ?? j.session?.code ?? String(code),
            setId: j.setId ?? j.session?.setId,
            status: j.status ?? j.session?.status,
          };
          if (s?.id && s?.setId) return s;
        }
      } catch {}
    }
    const qSetId = search.get("setId");
    if (qSetId) return { id: "adhoc", code: String(code), setId: qSetId, status: "RUNNING" };
    return null;
  }

  async function loadSet(setId: string): Promise<StudySet | null> {
    try {
      const r = await fetch(`/api/sets/${setId}`, { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      const cards: Card[] = (j.cards ?? j.data?.cards ?? []).filter((c: any) => c?.term && c?.definition);
      return {
        id: j.id ?? j.data?.id ?? setId,
        title: j.title ?? j.data?.title ?? j.name ?? j.data?.name ?? "Study Set",
        name: j.name,
        cards,
      };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const s = await loadSession();
      if (cancel) return;

      setSession(s);
      if (!s?.setId) {
        setLoading(false);
        return;
      }

      const st = await loadSet(s.setId);
      if (cancel) return;

      setSetData(st);
      if (st?.cards?.length) {
        setQuestions(buildQuestions(st.cards));
      }
      setIdx(0);
      setSelected(null);
      setReveal(false);
      setTimerSec(10);
      setTimeoutReveal(false);
      setLoading(false);
    })();

    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /** ---- Progress text (used by pill) ---- */
  const progressText = useMemo(() => {
    if (!questions.length) return "0 / 0";
    const qNo = Math.min(idx + 1, Math.max(1, questions.length));
    return `${qNo} / ${questions.length}`;
  }, [idx, questions.length]);

  function onSelect(choiceId: string) {
    if (reveal || finished) return; // lock after reveal or on finish
    setSelected(choiceId);
    setReveal(true); // timer stops because reveal is true
  }

  /** Auto-advance 2s after reveal (answer or timeout) */
  useEffect(() => {
    if (!reveal || finished) return;
    const t = setTimeout(() => {
      setSelected(null);
      setReveal(false);
      setTimeoutReveal(false);
      setIdx((i) => i + 1); // may flip to finished
      setTimerSec(10);
    }, 2000);
    return () => clearTimeout(t);
  }, [reveal, finished]);

  /** Reset timer on new index */
  useEffect(() => {
    setTimerSec(10);
    setTimeoutReveal(false);
  }, [idx]);

  /** Countdown: runs only when not revealing and not finished */
  useEffect(() => {
    if (finished || reveal) return;
    const id = setInterval(() => {
      setTimerSec((t) => {
        if (t <= 1) {
          clearInterval(id);
          // Timeout: reveal correct answer with RED outline (not green)
          setTimeoutReveal(true);
          setReveal(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [reveal, finished, idx]);

  /** ---- Full-bleed gray polkadot background ---- */
  const BgDots = () => (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.10) 0.9px, transparent 0.9px), linear-gradient(to bottom, #f7f8fb 0%, #f7f8fb 52%, #c9cdd5 100%)",
        backgroundSize: "12px 12px, 100% 100%",
        backgroundPosition: "0 0, 0 0",
        backgroundColor: "#f7f8fb",
      }}
    />
  );

  /** Edge-hugging shadow: diagonal rim (no corner double-dark) + soft ambient (cards) */
  const edgeShadowStyle: React.CSSProperties = {
    filter:
      "drop-shadow(3px 3px 0 rgba(0,0,0,0.22)) drop-shadow(12px 16px 22px rgba(0,0,0,0.10))",
  };

  /** Lighter variant for the top-left/right pills */
  const pillShadowStyle: React.CSSProperties = {
    filter:
      "drop-shadow(2px 2px 0 rgba(0,0,0,0.14)) drop-shadow(10px 12px 20px rgba(0,0,0,0.08))",
  };

  /** ---- BGM active condition ---- */
  const bgmActive = useMemo(
    () => !!session && session.status === "RUNNING" && !loading && questions.length > 0 && !finished,
    [session, loading, questions.length, finished]
  );

  /** --- Render --- */
  if (loading) {
    return (
      <div className={`${continuum.className} relative h-full`}>
        <BgDots />
        <div className="relative z-10 flex h-full items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-white/15 bg-white/5 px-7 py-5 text-[15px] text-white/80"
          >
            Loading arena…
          </motion.div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`${continuum.className} relative h-full`}>
        <BgDots />
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-7 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">Session not found</h2>
            <p className="text-sm text-white/80">
              I couldn’t locate a duel session for code <span className="font-mono">{String(code)}</span>.{" "}
              Ensure the session API returns <code>setId</code>, or pass <code>?setId=</code> in the URL.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!setData || !setData.cards?.length) {
    return (
      <div className={`${continuum.className} relative h-full`}>
        <BgDots />
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="max-w-md rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-7 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">No cards in set</h2>
            <p className="text-sm text-white/80">
              The selected set has no usable term/definition pairs. Add cards then reload.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BgDots />
      {/* Looping BGM when the game is actually running */}
      <ArenaBGM active={bgmActive} />

      {/* Top-left progress pill */}
      <div className="fixed left-5 top-5 z-20">
        <div
          className={`${continuum.className} rounded-[34px] border-[3px] border-[#716c76] bg-[#eae9f0] px-5 py-2`}
          style={pillShadowStyle}
        >
          <div className="text-[18px] font-bold tracking-tight text-[#716c76]">{progressText}</div>
        </div>
      </div>

      {/* Top-right timer pill */}
      <div className="fixed right-5 top-5 z-20">
        <div
          className="rounded-[34px] border-[3px] border-[#716c76] bg-[#eae9f0] px-5 py-2 flex items-center gap-2"
          style={pillShadowStyle}
        >
          <img src="/icons/timer.svg" alt="" className="h-5 w-5 select-none" />
          <div className={`${continuum.className} text-[18px] font-bold leading-none text-[#716c76]`}>
            {timerSec}
          </div>
        </div>
      </div>

      <div className={`${continuum.className} relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col px-5 py-7`}>
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Chip>Code: {session.code}</Chip>
            <Chip>Set</Chip>
          </div>
          <div className="text-right">
            <div className="text-[15px] text-white/70">{setData.title ?? setData.name ?? "Study Set"}</div>
            {/* Progress moved to the top-left pill */}
          </div>
        </div>

        {/* Card area */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full">
            <AnimatePresence mode="wait">
              {!finished && current && (
                <motion.div
                  key={current.cardId + ":" + idx}
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                  className="relative mx-auto max-w-4xl"
                >
                  {/* TERM card */}
                  <div
                    className="rounded-[22px] border-[3px] border-white bg-[#eae9f0] p-6 md:p-7"
                    style={edgeShadowStyle}
                  >
                    <div className="mb-3.5 text-sm uppercase tracking-wide text-[#716c76] font-bold">Term</div>
                    <div className="text-balance text-[32px] leading-snug md:text-[38px] text-[#716c76] font-bold">
                      {current.term}
                    </div>
                  </div>

                  {/* Choices */}
                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {current.choices.map((c) => {
                      const isSelected = selected === c.id;
                      const isCorrect = c.isCorrect;

                      // Reveal logic:
                      // - Normal reveal: correct -> green outline; user's wrong pick -> red
                      // - Timeout reveal: correct -> RED outline (special rule), others -> no outline
                      const revealOutline = reveal
                        ? timeoutReveal
                          ? isCorrect
                            ? "outline outline-2 outline-rose-400"
                            : ""
                          : isCorrect
                          ? "outline outline-2 outline-emerald-400"
                          : isSelected
                          ? "outline outline-2 outline-rose-400"
                          : ""
                        : "";

                      return (
                        <button
                          key={c.id}
                          disabled={reveal}
                          onClick={() => onSelect(c.id)}
                          className={`group rounded-[22px] border-[3px] border-white bg-[#eae9f0] px-5 py-5 text-left transition hover:brightness-[1.02] ${revealOutline}`}
                          style={edgeShadowStyle}
                        >
                          <div className="text-[13px] uppercase tracking-wide text-[#716c76] font-bold">Answer</div>
                          <div className="mt-1.5 text-[18px] leading-snug md:text-[19px] text-[#716c76] font-medium">
                            {c.text}
                          </div>

                          {/* Subtle sheen on hover */}
                          <span
                            className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 transition group-hover:opacity-100"
                            style={{
                              background:
                                "radial-gradient(160px 80px at 20% 0%, rgba(255,255,255,0.25), rgba(255,255,255,0))",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer (status only; auto-advances after 2s) */}
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-[15px] text-[#716c76]">
                      {reveal ? (
                        current.choices.find((c) => c.isCorrect)?.id === selected ? (
                          <span className="text-emerald-600 font-semibold">Correct!</span>
                        ) : (
                          <>
                            <span className="text-rose-600 font-semibold">Wrong.</span>{" "}
                            <span className="text-[#716c76]">Correct: {current.correctDefinition}</span>
                          </>
                        )
                      ) : (
                        <span>Select an answer.</span>
                      )}
                    </div>
                    <div className="text-sm text-[#716c76]/70">
                      {reveal ? "Advancing…" : `Time left: ${timerSec}s`}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {finished && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mx-auto max-w-lg rounded-[22px] border-[3px] border-white bg-[#eae9f0] p-7 text-center"
                style={edgeShadowStyle}
              >
                <div className="mb-2 text-xl font-bold text-[#716c76]">Great run!</div>
                <div className="text-[15px] text-[#716c76]">You’ve reached the end of this set preview.</div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
