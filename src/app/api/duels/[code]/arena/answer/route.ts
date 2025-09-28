// src/app/api/duels/[code]/arena/answer/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoundState } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Minimal version:
 * - Validate live round
 * - Upsert answer (one per player/round)
 * - TODO: compute isCorrect from Card linked by questionCardId
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const { playerId, choiceIndex, ms } = await req.json();

  if (!playerId || typeof choiceIndex !== "number") {
    return NextResponse.json({ error: "Missing playerId or choiceIndex" }, { status: 400 });
  }

  const sess = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      rounds: {
        select: { id: true, state: true, timerSec: true, startedAt: true, roundNo: true, questionCardId: true },
        orderBy: { roundNo: "desc" },
        take: 1,
      },
    },
  });
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const round = sess.rounds[0];
  if (!round || round.state !== RoundState.LIVE) {
    return NextResponse.json({ error: "No live round" }, { status: 400 });
  }

  const existing = await prisma.duelAnswer.findFirst({
    where: { roundId: round.id, playerId },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true });

  const responseMs = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;

  await prisma.duelAnswer.create({
    data: { roundId: round.id, playerId, choiceIndex, isCorrect: false, responseMs },
  });

  return NextResponse.json({ ok: true, isCorrect: false });
}
