// /src/app/(game)/duels/[code]/arena/page.tsx
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

  stats?: {
    correct?: number;
    elapsedMs?: number;
    elapsedTotalMs?: number;
    lastCorrectAt?: number;
  } | null;
  correct?: number;
  elapsedMs?: number;
  score?: number;

  role?: "PLAYER" | "SPECTATOR";
  lives?: number | null;
  eliminatedAt?: string | null;

  // NEW:
  isFinished?: boolean;
  finishedAt?: string | null;
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

function looksLikeCuidish(s?: string | null): boolean {
  if (!s) return false;
  return /^[a-z0-9]{24,32}$/.test(s) && s[0] === "c";
}
function normalizeName(username?: string | null, displayName?: string | null): string {
  if (username && !looksLikeCuidish(username)) return username;
  if (displayName && !looksLikeCuidish(displayName)) return displayName;
  return "Player";
}

function fmtMs(ms?: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function mapPlayers(arr: any[]): PlayerLite[] {
  return (arr ?? [])
    .map((p: any) => ({
      id: p.id ?? p.userId ?? crypto.randomUUID(),
      username: p.user?.username ?? p.username ?? null,
      displayName: p.displayName ?? p.user?.username ?? p.name ?? null,
      avatar: (p.user?.avatar ?? p.avatar) as Avatar,

      stats: p.stats ?? null,
      correct: p.correct ?? p.stats?.correct ?? undefined,
      elapsedMs: p.elapsedMs ?? p.stats?.elapsedMs ?? undefined,
      score: p.score ?? undefined,

      role: (p.role as PlayerLite["role"]) ?? "PLAYER",
      lives: p.lives ?? null,
      eliminatedAt: p.eliminatedAt ?? null,

      // NEW:
      isFinished: !!p.isFinished,
      finishedAt: p.finishedAt ?? null,
    }))
    .filter((p: PlayerLite) => !!p.id);
}

/** Auth headers helper */
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

/** Identity helpers */
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

/** Background */
function BgDots() {
  return (
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
}

/** Conservative roster check: someone is still actively playing? */
function rosterSaysSomeoneStillPlaying(players: PlayerLite[]): boolean {
  return players.some((p) => {
    if (p.role === "SPECTATOR") return false;
    const alive = p.lives == null || p.lives > 0;
    const hasResult = (p.stats?.correct ?? p.correct ?? 0) > 0 || (p.score ?? 0) > 0;
    const finished = !!p.isFinished || !!p.eliminatedAt || (p.lives != null && p.lives <= 0);
    return alive && !finished && !hasResult; // conservative
  });
}

/** Rank players & compute total time */
function rankPlayersForArena(players: PlayerLite[]) {
  const rows = players.map((p) => {
    const correct = (p.stats?.correct ?? p.correct ?? 0) as number;
    const score = (p.score ?? 0) as number;
    const avg = (p.stats?.elapsedMs ?? p.elapsedMs ?? Number.POSITIVE_INFINITY) as number;

    const countForTotal = correct > 0 ? correct : (Number.isFinite(score) ? (score as number) : 0);
    const total =
      typeof p.stats?.elapsedTotalMs === "number"
        ? p.stats.elapsedTotalMs
        : Number.isFinite(avg) && countForTotal > 0
        ? Math.round(avg * countForTotal)
        : null;

    return {
      id: p.id,
      name: normalizeName(p.username ?? null, p.displayName ?? null),
      avatar: extractAvatarSrc(p.avatar ?? null),
      correct,
      score,
      avg,
      total,
    };
  });

  return rows
    .filter((r) => r.correct > 0 || r.score > 0)
    .sort((a, b) => {
      const aPrimary = a.correct || a.score;
      const bPrimary = b.correct || b.score;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      if (a.avg !== b.avg) return a.avg - b.avg;
      return a.id.localeCompare(b.id);
    });
}

/** Avatar */
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
  const [sseConnected, setSseConnected] = useState(false);
  const gotRosterRef = useRef(false);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const [leaderIdServer, setLeaderIdServer] = useState<string | null>(null);
  const [leaderNameServer, setLeaderNameServer] = useState<string | null>(null);
  const [leaderAvatarServer, setLeaderAvatarServer] = useState<string | null>(null);

  // server hint that everyone is done
  const [everyoneDone, setEveryoneDone] = useState(false);

  const finished = idx >= questions.length;
  const current = !finished ? questions[idx] : undefined;

  async function joinLobby() {
    try {
      const userId = getSignedInUserId();
      const body = userId ? { userId } : { displayName: getStableGuestName() };
      const r = await fetch(`/api/duels/${encodeURIComponent(String(code))}/join`, {
        method: "POST",
        ...getAuthInit(),
        headers: { "Content-Type": "application/json", ...(getAuthInit().headers || {}) },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const j = await r.json().catch(() => null);
      if (j?.playerId) setMyPlayerId(String(j.playerId));
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
      const rawCards = j.cards ?? j.data?.cards ?? [];
      const cards: Card[] = rawCards
        .map((c: any) => ({
          id: c.id ?? c.cardId ?? crypto.randomUUID(),
          term: c.term ?? c.front ?? c.prompt ?? c.question ?? c.q,
          definition: c.definition ?? c.back ?? c.answer ?? c.a ?? c.response,
          skill: c.skill ?? null,
        }))
        .filter((c: Card) => c.term && c.definition);
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

  /** Poll until roster seen at least once */
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!session?.id) return;

    const startPolling = () => {
      if (pollRef.current) return;
      const poll = async () => {
        const fresh = await loadPlayersFromAPIs();
        if (fresh.length) {
          setPlayers(fresh);
          gotRosterRef.current = true;
          if (rosterSaysSomeoneStillPlaying(fresh)) setEveryoneDone(false);
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

  /** SSE: roster, leader, guarded all-finished */
  useEffect(() => {
    if (!session?.id) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/duels/${code}/sse`, { withCredentials: true });
    } catch {
      return;
    }

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.onmessage = (evt) => {
      if (!evt.data) return;
      try {
        const data = JSON.parse(evt.data);
        const type = data?.type ?? data?.kind ?? data?.event ?? "message";

        if ((type === "lobby-state" || type === "lobby:update") && data?.session?.players) {
          const mapped = mapPlayers(data.session.players);
          setPlayers(mapped);
          if (mapped.length) gotRosterRef.current = true;
          if (rosterSaysSomeoneStillPlaying(mapped)) setEveryoneDone(false);
          if (data?.session?.status) {
            setSession((s) => (s ? { ...s, status: data.session.status } : s));
          }
        } else if (type === "leader" || type === "arena:leader") {
          if (data.leaderId) setLeaderIdServer(String(data.leaderId));
          else setLeaderIdServer(null);
          setLeaderNameServer(
            normalizeName(data.leaderUsername ?? data.leaderName ?? null, data.leaderUsername ?? null)
          );
          setLeaderAvatarServer(data.leaderAvatar ?? null);
        } else if (type === "all-finished") {
          // (guard by sessionId if provided)
          const ok = !data.sessionId || !session?.id || String(data.sessionId) === String(session.id);
          if (ok) setEveryoneDone(!!data.allFinished);
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      setSseConnected(false);
      try { es?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, code]);

  /** Progress text */
  const progressText = useMemo(() => {
    if (!questions.length) return "0 / 0";
    const qNo = Math.min(idx + 1, Math.max(1, questions.length));
    return `${qNo} / ${questions.length}`;
  }, [idx, questions.length]);

  async function addScore(delta = 1) {
    if (!myPlayerId) return;
    try {
      await fetch(`/api/duels/${encodeURIComponent(String(code))}/score`, {
        method: "POST",
        ...getAuthInit(),
        headers: { "Content-Type": "application/json", ...(getAuthInit().headers || {}) },
        body: JSON.stringify({ playerId: myPlayerId, delta }),
      });
    } catch {}
  }

  function onSelect(choiceId: string) {
    if (reveal || finished) return;
    setSelected(choiceId);

    const isCorrect = !!current?.choices.find((c) => c.id === choiceId)?.isCorrect;
    if (isCorrect) addScore(1);

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

  /** Fire once when this player completes their local questions */
  const postedFinishRef = useRef(false);
  useEffect(() => {
    if (!finished || postedFinishRef.current || !myPlayerId) return;
    postedFinishRef.current = true;
    fetch(`/api/duels/${encodeURIComponent(String(code))}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: myPlayerId }),
    }).catch(() => {});
  }, [finished, myPlayerId, code]);

  /** Shadows */
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

  /** Leader (server-preferred, else client-computed if real stats exist) */
  const leaderFromPlayers = useMemo(() => {
    if (!players.length) return null;

    const active = players.filter((p) => p.role !== "SPECTATOR" && !p.eliminatedAt && (p.lives == null || p.lives > 0));
    const pool = active.length ? active : players;

    const best = pool
      .slice()
      .sort((a, b) => {
        const ac = (a.stats?.correct ?? a.correct ?? a.score ?? 0) as number;
        const bc = (b.stats?.correct ?? b.correct ?? b.score ?? 0) as number;
        if (ac !== bc) return bc - ac;

        const at = (a.stats?.elapsedMs ?? a.elapsedMs ?? Number.POSITIVE_INFINITY) as number;
        const bt = (b.stats?.elapsedMs ?? b.elapsedMs ?? Number.POSITIVE_INFINITY) as number;
        if (at !== bt) return at - bt;

        return a.id.localeCompare(b.id);
      })[0];

    return best?.id ?? null;
  }, [players]);

  function hasRealStats(p?: PlayerLite | null) {
    if (!p) return false;
    const correct = (p.stats?.correct ?? p.correct ?? 0) as number;
    const score = (p.score ?? 0) as number;
    return correct > 0 || score > 0;
  }

  let leaderId: string | null = null;
  if (leaderIdServer) {
    leaderId = leaderIdServer;
  } else {
    const candidateId = leaderFromPlayers ?? null;
    const candidate = players.find((p) => p.id === candidateId) || null;
    leaderId = hasRealStats(candidate) ? candidateId : null;
  }

  const playersOrdered = useMemo(() => {
    if (!leaderId) return players;
    const lead = players.find((p) => p.id === leaderId);
    if (!lead) return players;
    const rest = players.filter((p) => p.id !== leaderId);
    return [lead, ...rest];
  }, [players, leaderId]);

  const leaderPlayer = useMemo(
    () => (leaderId ? players.find((p) => p.id === leaderId) || null : null),
    [leaderId, players]
  );
  const leaderName =
    leaderNameServer ?? normalizeName(leaderPlayer?.username ?? null, leaderPlayer?.displayName ?? null);
  const leaderAvatar =
    leaderAvatarServer ?? (leaderPlayer ? extractAvatarSrc(leaderPlayer.avatar ?? null) : null);

  const leaderboard = useMemo(() => rankPlayersForArena(players), [players]);
  const isFinalSession = session?.status === "ENDED" || session?.status === "CANCELLED";

  /** Only show Final when: session ended OR server says all-finished,
   * and roster doesn't contradict it (defensive).
   */
  const finalReady = (isFinalSession || everyoneDone) && !rosterSaysSomeoneStillPlaying(players);

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
            <h2 className="mb-2 text-xl font-bold text-white">Session not found</h2>
            <p className="text-sm text-white/80">
              Couldn’t locate a duel session for code <span className="font-mono">{String(code)}</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className={`${continuum.className} relative h-full`}>
        <BgDots />
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="max-w-md rounded-2xl border-[3px] border-white bg-[#eae9f0] p-7 text-center">
            <h2 className="mb-2 text-xl font-bold text-[#716c76]">No cards in set</h2>
            <p className="text-sm text-[#716c76] font-medium">
              This set produced no usable term/definition pairs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BgDots />
      <ArenaBGM active={bgmActive} />

      {/* Left progress pill */}
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

      {/* Right timer pill */}
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

      {/* Players column (leader first) */}
      <div className="fixed right-3 z-20 flex flex-col items-end gap-3 pt-5" style={{ top: "96px" }}>
        {playersOrdered.map((p, i) => {
          const isLeader = !!leaderId && p.id === leaderId && i === 0;
          const size = isLeader ? LEADER_SIZE : AVATAR_SIZE;
          const label = normalizeName(p.username ?? null, p.displayName ?? null);

          return (
            <div key={p.id} className="flex items-center gap-2">
              {isLeader && (
                <div
                  className={`${continuum.className} text-[20px] font-bold tracking-[0.03em] text-[#716c76]`}
                  style={{ textShadow: "0 1px 0 rgba(255,255,255,0.35)", marginRight: 2 }}
                  title={leaderName || label}
                >
                  {leaderName || label}
                </div>
              )}
              <AvatarCircle
                name={isLeader ? (leaderName || label) : label}
                src={isLeader ? leaderAvatar || extractAvatarSrc(p.avatar ?? null) : extractAvatarSrc(p.avatar ?? null)}
                size={size}
              />
            </div>
          );
        })}
      </div>

      {/* Set title pill */}
      <div className="fixed left-1/2 top-5 z-20 -translate-x-1/2">
        <div
          className={`${continuum.className} flex h-[54px] items-center rounded-[34px] border-[3px] border-white bg-[#eae9f0] px-8`}
          style={edgeShadowStyle}
        >
          <div className="text-[20px] font-bold tracking-[0.03em] text-[#716c76]">
            {setData?.title ?? setData?.name ?? "Study Set"}
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
                    <div className="text-[15px] text-[#716c76] font-medium">
                      {reveal ? (
                        current.choices.find((c) => c.isCorrect)?.id === selected ? (
                          <span className="text-emerald-600 font-bold">Correct!</span>
                        ) : (
                          <>
                            <span className="text-rose-600 font-bold">Wrong.</span>{" "}
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

            {/* Results / Leaderboard */}
            {finished && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mx-auto w-full max-w-2xl"
              >
                {!finalReady ? (
                  <div
                    className="rounded-[22px] border-[3px] border-white bg-[#eae9f0] p-6 md:p-7 text-[#716c76]"
                    style={edgeShadowStyle}
                  >
                    <div className="text-xl font-bold">Waiting for all players to finish…</div>
                  </div>
                ) : (
                  <div
                    className="rounded-[22px] border-[3px] border-white bg-[#eae9f0] p-6 md:p-7"
                    style={edgeShadowStyle}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xl font-bold text-[#716c76]">Final leaderboard</div>
                    </div>

                    {leaderboard.length ? (
                      <div className="mt-2 space-y-2">
                        {leaderboard.map((r, i) => {
                          const rank = i + 1;
                          const isPodium = rank <= 3;
                          const size = isPodium && rank === 1 ? 56 : 44;
                          const medal =
                            rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);

                          return (
                            <div
                              key={r.id}
                              className="flex items-center justify-between rounded-xl border-[3px] border-white bg-white/50 px-3 py-2"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-6 text-center text-lg">{medal}</div>
                                <AvatarCircle name={r.name} src={r.avatar} size={size} />
                                <div className="ml-1">
                                  <div className="text-[15px] text-[#716c76] font-bold">{r.name}</div>
                                  <div className="text-xs text-[#716c76]/70 font-medium">
                                    Total time: {fmtMs(r.total)}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[15px] font-bold text-[#716c76]">
                                  {r.correct > 0 ? `${r.correct}` : `${r.score}`}
                                </div>
                                <div className="text-xs text-[#716c76]/70 font-medium">
                                  {r.correct > 0 ? "correct" : "points"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-1 rounded-xl border-[3px] border-white bg-white/40 px-4 py-4 text-center text-[#716c76] font-medium">
                        Nobody answered correctly.
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
