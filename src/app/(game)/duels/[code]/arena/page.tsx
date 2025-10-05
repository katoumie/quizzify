// src/app/(game)/duels/[code]/arena/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { continuum } from "@/app/fonts";
import ArenaBGM from "@/components/ArenaBGM";

/** --- Types --- */
type Card = { id: string; term: string; definition: string; skill?: string | null };
type StudySet = { id: string; title?: string; name?: string; cards: Card[] };
type Choice = { id: string; text: string; isCorrect: boolean };
type BuiltQ = { cardId: string; term: string; correctDefinition: string; choices: Choice[] };

type AvatarObj = { kind: "builtin" | "upload"; src: string };
type Avatar = string | AvatarObj | null | undefined;

type PlayerLite = {
  id: string;
  displayName?: string | null;
  username?: string | null;
  avatar?: Avatar;
  correct?: number;
  elapsedMs?: number;
  stats?: { correct?: number; elapsedMs?: number } | null;
};

type DuelSessionLite = {
  id: string;
  code: string;
  setId: string;
  status?: string;
  players?: PlayerLite[];
};

/** --- Config --- */
const AVATAR_SIZE = 48;
const LEADER_SIZE = 64;
const SESSION_KEY = "qz_auth";
const GUEST_NAME_KEY = "qz_display_name";

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

function extractAvatarSrc(avatar: Avatar): string | null {
  if (!avatar) return null;
  if (typeof avatar === "string") return avatar || null;
  if (typeof avatar === "object" && "src" in avatar && typeof (avatar as AvatarObj).src === "string") {
    return (avatar as AvatarObj).src || null;
  }
  return null;
}

function mapPlayers(arr: any[]): PlayerLite[] {
  return (arr ?? [])
    .map((p: any) => ({
      id: p.id ?? p.userId ?? crypto.randomUUID(),
      displayName: p.displayName ?? p.user?.username ?? p.username ?? p.name ?? null,
      username: p.user?.username ?? p.username ?? null,
      avatar: (p.user?.avatar ?? p.avatar) as Avatar,
      correct: p.correct ?? p.stats?.correct ?? undefined,
      elapsedMs: p.elapsedMs ?? p.stats?.elapsedMs ?? undefined,
      stats: p.stats ?? null,
    }))
    .filter((p: PlayerLite) => !!p.id);
}

/** Send cookies + optional bearer (for non-SSE fetches) */
function getAuthInit(): RequestInit {
  let headers: HeadersInit = {};
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as any;
      const token = s?.token || s?.accessToken || s?.jwt || null;
      if (token) headers = { ...headers, Authorization: `Bearer ${token}` };
    }
  } catch {}
  return { credentials: "include", headers };
}

/** Identity helpers — SAME contract as the lobby */
function getSignedInUserId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as any;
    return s?.id ? String(s.id) : null;
  } catch {
    return null;
  }
}
function getStableGuestName(): string {
  try {
    const n = localStorage.getItem(GUEST_NAME_KEY);
    if (n && n.trim()) return n.trim();
  } catch {}
  const name = `Guest-${Math.random().toString(36).slice(2, 7)}`;
  try {
    localStorage.setItem(GUEST_NAME_KEY, name);
  } catch {}
  return name;
}

/** Leader comparator: "most correct, then fastest" */
function computeLeaderId(players: PlayerLite[]): string | null {
  if (!players.length) return null;
  const withAnyStats = players.filter(
    (p) =>
      typeof (p.correct ?? p.stats?.correct) === "number" ||
      typeof (p.elapsedMs ?? p.stats?.elapsedMs) === "number"
  );
  const pool = withAnyStats.length ? withAnyStats : players;
  const best = pool
    .slice()
    .sort((a, b) => {
      const ac = (a.correct ?? a.stats?.correct ?? 0) as number;
      const bc = (b.correct ?? b.stats?.correct ?? 0) as number;
      if (ac !== bc) return bc - ac;
      const at = (a.elapsedMs ?? a.stats?.elapsedMs ?? Number.POSITIVE_INFINITY) as number;
      const bt = (b.elapsedMs ?? b.stats?.elapsedMs ?? Number.POSITIVE_INFINITY) as number;
      if (at !== bt) return at - bt;
      return a.id.localeCompare(b.id);
    })[0];
  return best?.id ?? null;
}

/** Avatar circle */
function AvatarCircle({ name, src, size = AVATAR_SIZE }: { name?: string | null; src?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials =
    (name ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";
  const dim = `${size}px`;
  const finalSrc = !src || err ? null : src;

  if (!finalSrc) {
    return (
      <div
        className="grid place-items-center rounded-full border-[3px] border-white"
        style={{
          width: dim,
          height: dim,
          background: "#f0d94a",
          color: "#862a2a",
          fontWeight: 800,
          fontSize: Math.max(12, Math.floor(size * 0.42)),
          filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.14))",
        }}
        aria-label={name ?? "Player"}
        title={name ?? "Player"}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={finalSrc}
      alt={name ?? "Player"}
      title={name ?? "Player"}
      className="block rounded-full border-[3px] border-white"
      style={{ width: dim, height: dim, objectFit: "cover", filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.14))" }}
      onError={() => setErr(true)}
    />
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

  const [timerSec, setTimerSec] = useState(10);
  const [timeoutReveal, setTimeoutReveal] = useState(false);

  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [debugCount, setDebugCount] = useState(0);
  const [lastEvt, setLastEvt] = useState<string>("—");
  const [sseConnected, setSseConnected] = useState(false);
  const gotRosterRef = useRef(false);

  const finished = idx >= questions.length;
  const current = !finished ? questions[idx] : undefined;

  async function joinLobby() {
    try {
      const userId = getSignedInUserId();
      const body = userId ? { userId } : { displayName: getStableGuestName() };
      await fetch(`/api/duels/${encodeURIComponent(String(code))}/join`, {
        method: "POST",
        ...getAuthInit(),
        headers: { "Content-Type": "application/json", ...(getAuthInit().headers || {}) },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch {}
  }
  async function leaveLobby() {
    try {
      await fetch(`/api/duels/${encodeURIComponent(String(code))}/leave`, {
        method: "POST",
        ...getAuthInit(),
        headers: { "Content-Type": "application/json", ...(getAuthInit().headers || {}) },
        body: JSON.stringify({}),
        keepalive: true,
      });
    } catch {}
  }

  async function loadSession(): Promise<DuelSessionLite | null> {
    const tryPaths = [`/api/duels/${code}`, `/api/duels/${code}/session`];
    for (const p of tryPaths) {
      try {
        const r = await fetch(p, { cache: "no-store", ...getAuthInit() });
        if (r.ok) {
          const j = await r.json();
          const raw = j.session ?? j;
          const s: DuelSessionLite = {
            id: raw?.id ?? String(code),
            code: raw?.code ?? String(code),
            setId: raw?.setId,
            status: raw?.status,
            players: raw?.players ? mapPlayers(raw.players) : undefined,
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
      const r = await fetch(`/api/sets/${setId}`, { cache: "no-store", ...getAuthInit() });
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

  async function loadPlayersFromAPIs(): Promise<PlayerLite[]> {
    try {
      const r = await fetch(`/api/duels/${code}/players`, { cache: "no-store", ...getAuthInit() });
      if (r.ok) {
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j.players ?? [];
        if (Array.isArray(arr) && arr.length) return mapPlayers(arr);
      }
    } catch {}
    try {
      const r = await fetch(`/api/duels/${code}`, { cache: "no-store", ...getAuthInit() });
      if (r.ok) {
        const j = await r.json();
        const raw = j.session ?? j;
        if (raw?.players?.length) return mapPlayers(raw.players);
      }
    } catch {}
    try {
      const r = await fetch(`/api/duels/${code}/session`, { cache: "no-store", ...getAuthInit() });
      if (r.ok) {
        const j = await r.json();
        const raw = j.session ?? j;
        if (raw?.players?.length) return mapPlayers(raw.players);
      }
    } catch {}
    return [];
  }

  /** Bootstrap */
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);

      await joinLobby();
      if (cancel) return;

      const firstRoster = await loadPlayersFromAPIs().catch(() => []);
      if (!cancel && firstRoster.length) {
        setPlayers(firstRoster);
        setDebugCount(firstRoster.length);
        gotRosterRef.current = true;
      }

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
      if (st?.cards?.length) setQuestions(buildQuestions(st.cards));

      setIdx(0);
      setSelected(null);
      setReveal(false);
      setTimerSec(10);
      setTimeoutReveal(false);
      setLoading(false);
    })();

    return () => {
      cancel = true;
      leaveLobby();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /** Polling until roster present */
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!session?.id) return;

    const startPolling = () => {
      if (pollRef.current) return;
      const poll = async () => {
        const fresh = await loadPlayersFromAPIs();
        if (fresh.length) {
          setPlayers(fresh);
          setDebugCount(fresh.length);
          gotRosterRef.current = true;
        }
      };
      poll();
      pollRef.current = setInterval(poll, 3000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    if (!gotRosterRef.current) startPolling();
    if (gotRosterRef.current) stopPolling();

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, players.length]);

  /** SSE */
  useEffect(() => {
    if (!session?.id) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/duels/${code}/sse`, { withCredentials: true });
    } catch {
      return;
    }

    es.onopen = () => {
      setSseConnected(true);
      setLastEvt("open");
    };
    es.onerror = () => {
      setSseConnected(false);
      setLastEvt("error");
    };
    es.onmessage = (evt) => {
      if (!evt.data) return;
      try {
        const data = JSON.parse(evt.data);
        const type = data?.type ?? "message";
        setLastEvt(type);

        if (type === "lobby-state" && data?.session?.players) {
          const mapped = mapPlayers(data.session.players);
          setPlayers(mapped);
          setDebugCount(mapped.length);
          if (mapped.length) gotRosterRef.current = true;
        } else if (type === "hb") {
          if (!gotRosterRef.current) {
            loadPlayersFromAPIs().then((fresh) => {
              if (fresh.length) {
                setPlayers(fresh);
                setDebugCount(fresh.length);
                gotRosterRef.current = true;
              }
            });
          }
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      setSseConnected(false);
      try {
        es?.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, code]);

  /** Progress text */
  const progressText = useMemo(() => {
    if (!questions.length) return "0 / 0";
    const qNo = Math.min(idx + 1, Math.max(1, questions.length));
    return `${qNo} / ${questions.length}`;
  }, [idx, questions.length]);

  function onSelect(choiceId: string) {
    if (reveal || finished) return;
    setSelected(choiceId);
    setReveal(true);
  }

  /** Auto-advance after 2s */
  useEffect(() => {
    if (!reveal || finished) return;
    const t = setTimeout(() => {
      setSelected(null);
      setReveal(false);
      setTimeoutReveal(false);
      setIdx((i) => i + 1);
      setTimerSec(10);
    }, 2000);
    return () => clearTimeout(t);
  }, [reveal, finished]);

  useEffect(() => {
    setTimerSec(10);
    setTimeoutReveal(false);
  }, [idx]);

  /** Countdown */
  useEffect(() => {
    if (finished || reveal) return;
    const id = setInterval(() => {
      setTimerSec((t) => {
        if (t <= 1) {
          clearInterval(id);
          setTimeoutReveal(true);
          setReveal(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [reveal, finished, idx]);

  /** Background + shadows */
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
  const edgeShadowStyle: React.CSSProperties = {
    filter: "drop-shadow(3px 3px 0 rgba(0,0,0,0.22)) drop-shadow(12px 16px 22px rgba(0,0,0,0.10))",
  };
  const pillShadowStyle: React.CSSProperties = {
    filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.14)) drop-shadow(10px 12px 20px rgba(0,0,0,0.08))",
  };

  /** BGM */
  const bgmActive = useMemo(
    () => !!session && session.status === "RUNNING" && !loading && questions.length > 0 && !finished,
    [session, loading, questions.length, finished]
  );

  /** Leader selection */
  const leaderId = useMemo(() => computeLeaderId(players), [players]);

  /** Render */
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
              I couldn’t locate a duel session for code <span className="font-mono">{String(code)}</span>. Ensure the session API returns <code>setId</code>, or pass <code>?setId=</code> in the URL.
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
            <p className="text-sm text-white/80">The selected set has no usable term/definition pairs. Add cards then reload.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BgDots />
      <ArenaBGM active={bgmActive} />

      {/* Left progress pill — cut to screen edge */}
      <div className="fixed left-0 top-5 z-20 -ml-[3px]">
        <div
          className={`${continuum.className} flex h-[46px] items-center rounded-l-none rounded-r-[34px] border-[3px] border-l-0 border-[#716c76] bg-[#eae9f0] px-5`}
          style={pillShadowStyle}
        >
          <div className="text-[18px] font-bold tracking-tight text-[#716c76]">
            {progressText}
          </div>
        </div>
      </div>

      {/* Right timer pill — cut to screen edge */}
      <div className="fixed right-0 top-5 z-20 -mr-[3px]">
        <div
          className="flex h-[46px] items-center rounded-r-none rounded-l-[34px] border-[3px] border-r-0 border-[#716c76] bg-[#eae9f0] px-6 gap-2"
          style={pillShadowStyle}
        >
          <span
            className="inline-block h-5 w-5 align-middle"
            style={{
              backgroundColor: "#716c76",
              WebkitMask: "url(/icons/timer.svg) no-repeat center / contain",
              mask: "url(/icons/timer.svg) no-repeat center / contain",
            }}
            aria-hidden
          />
          <div
            className={`${continuum.className} text-[18px] font-bold leading-none text-[#716c76] text-center`}
            style={{ fontVariantNumeric: "tabular-nums", minWidth: "2ch" }}
          >
            {timerSec}
          </div>
        </div>
      </div>

      {/* Players column (under timer) — extra top gap for space */}
      <div className="fixed right-3 z-20 flex flex-col items-end gap-3 pt-5" style={{ top: "86px" }}>
        {players.map((p) => {
          const isLeader = p.id === leaderId;
          const size = isLeader ? LEADER_SIZE : AVATAR_SIZE;
          const label = p.displayName ?? p.username ?? "Player";

          return (
            <div key={p.id} className="flex items-center gap-2">
              {/* Leader's username BEFORE avatar, styled exactly like Set Name */}
              {isLeader && (
                <div
                  className={`${continuum.className} text-[20px] font-bold tracking-[0.03em] text-[#716c76]`}
                  style={{ textShadow: "0 1px 0 rgba(255,255,255,0.35)", marginRight: 2 }}
                  title={label}
                >
                  {label}
                </div>
              )}
              <AvatarCircle name={label} src={extractAvatarSrc(p.avatar ?? null)} size={size} />
            </div>
          );
        })}
      </div>

      {/* Debug (dev only) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-2 right-2 z-20 rounded bg-black/40 px-2 py-1 text-xs text-white/80">
          players: {players.length} {sseConnected ? "(sse)" : "(poll)"} · last {lastEvt}
        </div>
      )}

      {/* Bigger center pill (set title) */}
      <div className="fixed left-1/2 top-5 z-20 -translate-x-1/2">
        <div
          className={`${continuum.className} flex h-[54px] items-center rounded-[34px] border-[3px] border-white bg-[#eae9f0] px-8`}
          style={edgeShadowStyle}
        >
          <div className="text-[20px] font-bold tracking-[0.03em] text-[#716c76]">
            {setData.title ?? setData.name ?? "Study Set"}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`${continuum.className} relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col px-5 py-7`}>
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
                  {/* Term card */}
                  <div className="rounded-[22px] border-[3px] border-white bg-[#eae9f0] p-6 md:p-7" style={edgeShadowStyle}>
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

                  {/* Footer */}
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
                    <div className="text-sm text-[#716c76]/70">{reveal ? "Advancing…" : `Time left: ${timerSec}s`}</div>
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
