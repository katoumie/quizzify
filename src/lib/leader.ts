// src/lib/duels/leader.ts
import { prisma } from "@/lib/prisma";

export type PlayerStats = {
  playerId: string;
  correct: number;
  avgMs: number | null;
  lastCorrectAt: number | null;
};

export async function aggregateCorrectStats(sessionId: string): Promise<PlayerStats[]> {
  const agg = await prisma.duelAnswer.groupBy({
    by: ["playerId"],
    where: { isCorrect: true, round: { sessionId } },
    _count: { _all: true },
    _avg: { responseMs: true },
    _max: { createdAt: true },
  });

  return agg.map((g) => ({
    playerId: g.playerId,
    correct: g._count._all,
    avgMs: g._avg.responseMs ?? null,
    lastCorrectAt: g._max.createdAt ? new Date(g._max.createdAt).getTime() : null,
  }));
}

// Sort: more correct → lower avgMs → earlier lastCorrect → id
export function rank(a: PlayerStats, b: PlayerStats) {
  if (a.correct !== b.correct) return b.correct - a.correct;
  const aAvg = a.avgMs ?? Number.POSITIVE_INFINITY;
  const bAvg = b.avgMs ?? Number.POSITIVE_INFINITY;
  if (aAvg !== bAvg) return aAvg - bAvg;
  const aLast = a.lastCorrectAt ?? Number.POSITIVE_INFINITY;
  const bLast = b.lastCorrectAt ?? Number.POSITIVE_INFINITY;
  if (aLast !== bLast) return aLast - bLast;
  return a.playerId.localeCompare(b.playerId);
}

export async function computeLeaderForSession(sessionId: string): Promise<string | null> {
  const rows = await aggregateCorrectStats(sessionId);
  rows.sort(rank);
  const leader = rows.find((r) => r.correct > 0) || null;
  return leader?.playerId ?? null;
}
