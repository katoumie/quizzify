// /src/app/api/duels/[code]/sse/route.ts
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

/** Helper to format SSE line */
function sse(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/** Build a compact signature for cheap diffing (status + roster) */
function buildSig(session: {
  status: string;
  startedAt?: Date | null;
  players: Array<any>;
}) {
  return JSON.stringify({
    status: session.status,
    startedAt: session.startedAt ? +new Date(session.startedAt) : null,
    players: session.players.map((p) => ({
      id: p.id,
      userId: p.userId ?? null,
      displayName: p.displayName ?? p.user?.username ?? "",
      isReady: !!p.isReady,
      lives: p.lives ?? 3,
      role: p.role ?? "PLAYER",
      avatar: p.user?.avatar ?? null,
      username: p.user?.username ?? null,
    })),
  });
}

/** Compute per-player correct + avg responseMs and return a Map */
async function getAnswerStatsMap(sessionId: string) {
  const agg = await prisma.duelAnswer.groupBy({
    by: ["playerId"],
    where: { isCorrect: true, round: { sessionId } },
    _count: { _all: true },
    _avg: { responseMs: true },
    _max: { createdAt: true },
  });

  const map = new Map<
    string,
    { correct: number; elapsedMs?: number; lastCorrectAt?: number }
  >();
  for (const g of agg) {
    map.set(g.playerId, {
      correct: g._count._all,
      elapsedMs:
        typeof g._avg.responseMs === "number" ? Math.round(g._avg.responseMs) : undefined,
      lastCorrectAt: g._max.createdAt ? +new Date(g._max.createdAt) : undefined,
    });
  }
  return map;
}

/** Pick leader from stats: more correct/score → lower avg time → earlier last-correct → id */
function pickLeaderFromStats(
  players: Array<{
    id: string;
    score?: number | null;
    stats?: { correct?: number; elapsedMs?: number; lastCorrectAt?: number } | null;
  }>
): string | null {
  const ranked = players
    .map((p) => ({
      id: p.id,
      correct: (p.stats?.correct ?? 0) as number,
      score: (p.score ?? 0) as number,
      avg: p.stats?.elapsedMs ?? Number.POSITIVE_INFINITY,
      last: p.stats?.lastCorrectAt ?? Number.POSITIVE_INFINITY,
    }))
    .filter((r) => r.correct > 0 || r.score > 0)
    .sort((a, b) => {
      const aPrimary = a.correct || a.score;
      const bPrimary = b.correct || b.score;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      if (a.avg !== b.avg) return a.avg - b.avg;
      if (a.last !== b.last) return a.last - b.last;
      return a.id.localeCompare(b.id);
    });

  return ranked[0]?.id ?? null;
}

/** Load current lobby snapshot and enrich with stats & score */
async function getLobbySnapshot(code: string) {
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
          lives: true,
          role: true,
          score: true,
          connectedAt: true,
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  if (!session) return null;

  // Aggregate stats once and attach to players
  const statsMap = await getAnswerStatsMap(session.id);

  return {
    id: session.id,
    code: session.code,
    status: session.status,
    hostId: session.hostId,
    setId: session.setId,
    startedAt: session.startedAt,
    players: session.players.map((p) => {
      const s = statsMap.get(p.id);
      return {
        id: p.id,
        userId: p.userId ?? null,
        displayName: p.displayName ?? p.user?.username ?? "Player",
        isReady: !!p.isReady,
        lives: p.lives ?? 3,
        role: p.role ?? "PLAYER",
        username: p.user?.username ?? null,
        avatar: p.user?.avatar ?? null,
        connectedAt: p.connectedAt,
        score: p.score ?? 0,
        stats: s
          ? { correct: s.correct, elapsedMs: s.elapsedMs, lastCorrectAt: s.lastCorrectAt }
          : { correct: 0, elapsedMs: undefined, lastCorrectAt: undefined },
      };
    }),
  };
}

export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const { code } = ctx.params;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastSig = "";
      let lastLeaderId: string | null = null;

      const send = (obj: any) => {
        try {
          controller.enqueue(new TextEncoder().encode(sse(obj)));
        } catch {
          // ignore
        }
      };

      // Initial snapshot
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
      send({ type: "hello", mode: "lobby", code, sessionId: initial.id });
      send({ type: "lobby-state", session: initial });

      // Initial leader (if any)
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

      // Polling loop: emit when status OR roster changes; also emit leader on change
      const pollMs = 1200;
      const poll = setInterval(async () => {
        if (closed) return;
        try {
          const snap = await getLobbySnapshot(code);
          if (!snap) return;

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
        } catch (err: any) {
          send({ type: "warn", message: err?.message ?? "poll-failed" });
        }
      }, pollMs);

      // Heartbeat
      const hb = setInterval(() => {
        if (closed) return;
        send({ type: "hb", ts: Date.now() });
      }, 15000);

      // best-effort cleanup
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(hb);
        try {
          controller.close();
        } catch {}
      };
      // @ts-ignore (some runtimes expose this)
      controller?.signal?.addEventListener?.("abort", close);
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
