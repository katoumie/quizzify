// /src/app/api/duels/[code]/sse/route.ts
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

/** SSE line helper */
function sse(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/* ===================== Stats (time-scoped) ===================== */

async function getAnswerStatsMap(sessionId: string, startedAt?: Date | null) {
  const where: any = { isCorrect: true, round: { sessionId } };
  if (startedAt) {
    // Only answers created after this run started
    where.createdAt = { gte: startedAt };
  }

  const agg = await prisma.duelAnswer.groupBy({
    by: ["playerId"],
    where,
    _count: { _all: true },
    _avg: { responseMs: true },
    _sum: { responseMs: true },
    _max: { createdAt: true },
  });

  const map = new Map<
    string,
    { correct: number; elapsedMs?: number; elapsedTotalMs?: number; lastCorrectAt?: number }
  >();
  for (const g of agg) {
    map.set(g.playerId, {
      correct: g._count._all,
      elapsedMs:
        typeof g._avg.responseMs === "number" ? Math.round(g._avg.responseMs) : undefined,
      elapsedTotalMs:
        typeof g._sum.responseMs === "number" ? Math.round(g._sum.responseMs) : undefined,
      lastCorrectAt: g._max.createdAt ? +new Date(g._max.createdAt) : undefined,
    });
  }
  return map;
}

/* ===================== Snapshot (normalized) ===================== */

type RawPlayer = {
  id: string;
  userId: string | null;
  displayName: string | null;
  isReady: boolean | null;
  role: string | null;
  score: number | null;
  connectedAt: Date;
  isFinished: boolean | null;
  finishedAt: Date | null;
  user?: { id: string; username: string | null; avatar: string | null } | null;
};

type Snap = {
  id: string;
  code: string;
  status: string | null;
  hostId: string | null;
  setId: string;
  startedAt: Date | null;
  players: Array<any>;
};

function normalizePlayersForRun(
  players: RawPlayer[],
  startedAt?: Date | null,
  statsMap?: Map<string, any>
) {
  const startMs = startedAt ? +startedAt : null;

  return players.map((p) => {
    const s = statsMap?.get(p.id);

    const finishedOk =
      !!startMs &&
      !!p.isFinished &&
      !!p.finishedAt &&
      +p.finishedAt >= startMs;

    // NEW: derive total time from finishedAt if we have no answer-based totals
    const finishDeltaMs =
      finishedOk && startMs != null ? Math.max(0, +p.finishedAt! - startMs) : undefined;

    const baseStats = s
      ? {
          correct: s.correct,
          elapsedMs: s.elapsedMs,
          elapsedTotalMs: s.elapsedTotalMs,
          lastCorrectAt: s.lastCorrectAt,
        }
      : {
          correct: 0,
          elapsedMs: undefined,
          elapsedTotalMs: undefined,
          lastCorrectAt: undefined,
        };

    // Prefer server totals from answers; otherwise use finish duration
    const mergedStats =
      typeof baseStats.elapsedTotalMs === "number"
        ? baseStats
        : { ...baseStats, elapsedTotalMs: finishDeltaMs };

    return {
      id: p.id,
      userId: p.userId ?? null,
      displayName: p.displayName ?? p.user?.username ?? "Player",
      isReady: !!p.isReady,
      role: p.role ?? "PLAYER",
      username: p.user?.username ?? null,
      avatar: p.user?.avatar ?? null,
      connectedAt: p.connectedAt,

      // time-scoped flags
      isFinished: finishedOk ? true : false,
      finishedAt: finishedOk ? p.finishedAt : null,

      // DO NOT use score to infer progress (no timestamp)
      score: p.score ?? 0,

      // <<— send stats with a derived total when needed
      stats: mergedStats,
    };
  });
}


async function getLobbySnapshot(code: string): Promise<Snap | null> {
  const session = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      status: true,
      hostId: true,
      setId: true,
      startedAt: true,
      players: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          isReady: true,
          role: true,
          score: true,
          connectedAt: true,
          isFinished: true,
          finishedAt: true,
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  if (!session) return null;

  const statsMap = await getAnswerStatsMap(session.id, session.startedAt);
  const players = normalizePlayersForRun(session.players as any, session.startedAt, statsMap);

  return {
    id: session.id,
    code: session.code,
    status: session.status,
    hostId: session.hostId,
    setId: session.setId,
    startedAt: session.startedAt,
    players,
  };
}

/* ===================== Leader & signature ===================== */

function pickLeaderFromStats(
  players: Array<{
    id: string;
    score?: number | null;
    stats?: { correct?: number; elapsedMs?: number; lastCorrectAt?: number } | null;
  }>
): string | null {
  type LeaderRow = {
    id: string;
    correct: number;
    score: number;
    avg: number;
    last: number;
  };

  const ranked: LeaderRow[] = players
    .map<LeaderRow>((p) => ({
      id: p.id,
      correct: (p.stats?.correct ?? 0) as number,
      score: (p.score ?? 0) as number,
      avg: (p.stats?.elapsedMs ?? Number.POSITIVE_INFINITY) as number,
      last: (p.stats?.lastCorrectAt ?? Number.POSITIVE_INFINITY) as number,
    }))
    .filter((r: LeaderRow) => r.correct > 0 || r.score > 0)
    .sort((a: LeaderRow, b: LeaderRow) => {
      const aPrimary = a.correct || a.score;
      const bPrimary = b.correct || b.score;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      if (a.avg !== b.avg) return a.avg - b.avg;
      if (a.last !== b.last) return a.last - b.last;
      return a.id.localeCompare(b.id);
    });

  return ranked[0]?.id ?? null;
}


function buildSig(session: { status?: string | null; startedAt?: Date | number | null; players: Array<any> }) {
  return JSON.stringify({
    status: session.status ?? null,
    startedAt: session.startedAt ? +new Date(session.startedAt) : null,
    players: session.players.map((p) => ({
      id: p.id,
      userId: p.userId ?? null,
      displayName: p.displayName ?? "",
      username: p.username ?? null,
      avatar: p.avatar ?? null,
      role: p.role ?? "PLAYER",
      isReady: !!p.isReady,
      // lives/eliminated removed
      score: p.score ?? 0,
      stats: p.stats
        ? {
            c: p.stats.correct ?? 0,
            a: p.stats.elapsedMs ?? null,
            t: p.stats.elapsedTotalMs ?? null,
            l: p.stats.lastCorrectAt ?? null,
          }
        : { c: 0, a: null, t: null, l: null },
      finished: !!p.isFinished,
      fAt: p.finishedAt ? +new Date(p.finishedAt) : null,
    })),
  });
}

/* ===================== Progress / Finalization (time-scoped) ===================== */

/** True iff there has been any *time-scoped* progress in this run:
 *    - at least one answer (stats.correct>0), OR
 *    - someone explicitly finished (isFinished time-scoped)
 */
function hasRunProgress(players: Array<any>) {
  const active = (players || []).filter((p) => p.role !== "SPECTATOR");
  if (!active.length) return false;
  return active.some((p) => !!p.isFinished || (p.stats?.correct ?? 0) > 0);
}

/** Only finalize after progress; finalize when every active player is explicitly finished this run. */
function computeAllFinishedStrict(
  snap: { status?: string | null; players: Array<any> },
  progressSeen: boolean
) {
  // Do not finalize in LOBBY; only during RUNNING or ENDED/CANCELLED.
  if (snap.status === "ENDED" || snap.status === "CANCELLED") return true;
  if (snap.status !== "RUNNING") return false;

  const active = (snap.players || []).filter((p) => p.role !== "SPECTATOR");
  if (!active.length) return false;
  if (!progressSeen) return false;

  return active.every((p) => !!p.isFinished);
}

/* ===================== SSE handler ===================== */

export async function GET(req: Request, ctx: { params: { code: string } }) {
  const { code } = ctx.params;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastSig = "";
      let lastLeaderId: string | null = null;
      let lastAllFinished: boolean | null = null;
      let progressSeen = false;

      const send = (obj: any) => {
        try {
          controller.enqueue(new TextEncoder().encode(sse(obj)));
        } catch { /* ignore */ }
      };

      // Initial
      const initial = await getLobbySnapshot(code);
      if (!initial) {
        send({ type: "error", message: "Lobby not found." });
        try { controller.close(); } catch {}
        return;
      }

      lastSig = buildSig({
        status: initial.status,
        startedAt: initial.startedAt,
        players: initial.players,
      });

      // Only consider time-scoped progress **once RUNNING**
      progressSeen = initial.status === "RUNNING" && hasRunProgress(initial.players);

      send({ type: "hello", mode: "lobby", code, sessionId: initial.id });
      send({ type: "lobby-state", session: initial });

      lastLeaderId = pickLeaderFromStats(initial.players);
      if (lastLeaderId) {
        const lp = initial.players.find((p) => p.id === lastLeaderId);
        send({
          type: "leader",
          leaderId: lastLeaderId,
          leaderUsername: lp?.username ?? null,
          leaderName: lp?.displayName ?? null,
          leaderAvatar: lp?.avatar ?? null,
        });
      }

      const poll = setInterval(async () => {
        if (closed) return;
        try {
          const snap = await getLobbySnapshot(code);
          if (!snap) return;

          if (!progressSeen && snap.status === "RUNNING" && hasRunProgress(snap.players)) {
            progressSeen = true;
          }

          const sig = buildSig({
            status: snap.status,
            startedAt: snap.startedAt,
            players: snap.players,
          });
          if (sig !== lastSig) {
            lastSig = sig;
            send({ type: "lobby-state", session: snap });
          }

          const leaderId = pickLeaderFromStats(snap.players);
          if (leaderId !== lastLeaderId) {
            lastLeaderId = leaderId;
            if (leaderId) {
              const lp = snap.players.find((p) => p.id === leaderId);
              send({
                type: "leader",
                leaderId,
                leaderUsername: lp?.username ?? null,
                leaderName: lp?.displayName ?? null,
                leaderAvatar: lp?.avatar ?? null,
              });
            } else {
              send({ type: "leader", leaderId: null });
            }
          }

          const allDone = computeAllFinishedStrict(snap, progressSeen);
          if (allDone !== lastAllFinished) {
            lastAllFinished = allDone;
            if (snap.status === "RUNNING" && progressSeen) {
              // Optional one-shot debug to prove reasons:
              // const why = (snap.players || []).filter(p => p.role !== "SPECTATOR").map((p:any) => ({
              //   id: p.id, isFinished: !!p.isFinished, finishedAt: p.finishedAt ? +new Date(p.finishedAt) : null,
              //   score: p.score ?? 0, correct: p.stats?.correct ?? 0
              // }));
              // send({ type: "debug-all-finished", progressSeen, why });

              send({ type: "all-finished", sessionId: snap.id, allFinished: allDone });
            }
          }
        } catch (err: any) {
          send({ type: "warn", message: err?.message ?? "poll-failed" });
        }
      }, 1200);

      const hb = setInterval(() => {
        if (closed) return;
        send({ type: "hb", ts: Date.now() });
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(hb);
        try { controller.close(); } catch {}
      };

      // Tie stream lifecycle to the Request’s signal
      (req as any)?.signal?.addEventListener?.("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
