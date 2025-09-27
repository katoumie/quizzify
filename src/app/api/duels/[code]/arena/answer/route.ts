// src/app/api/duels/[code]/arena/answer/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus"; // <-- import the singleton
import { buildQuestionPayload } from "../_helpers";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const { playerId, choiceIndex, ms } = await req.json();

  if (!playerId || typeof choiceIndex !== "number") {
    return NextResponse.json(
      { error: "Missing playerId or choiceIndex" },
      { status: 400 }
    );
  }

  const sess = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      setId: true,
      rounds: {
        select: {
          id: true,
          state: true,
          questionCardId: true,
          timerSec: true,
          startedAt: true,
          sessionId: true,
          roundNo: true,
        },
        orderBy: { roundNo: "desc" },
        take: 1,
      },
    },
  });
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const round = sess.rounds[0];
  if (!round || round.state !== "LIVE") {
    return NextResponse.json({ error: "No live round" }, { status: 400 });
  }

  // Already answered?
  const existing = await prisma.duelAnswer.findFirst({
    where: { roundId: round.id, playerId },
  });
  if (existing) return NextResponse.json({ ok: true });

  // Build the question to determine the correct choice
  const q = await buildQuestionPayload(round as any, sess.setId);
  const isCorrect = q.correctIndex === choiceIndex;

  // Ensure Int (non-null) for Prisma
  const responseMs =
    typeof ms === "number" && Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;

  await prisma.duelAnswer.create({
    data: {
      roundId: round.id,
      playerId,
      choiceIndex,
      isCorrect,
      responseMs,
    },
  });

  // Notify subscribers (SSE) via duelsBus
  duelsBus.publish(sess.id, { type: "answer", playerId, choiceIndex });

  return NextResponse.json({ ok: true, isCorrect });
}
