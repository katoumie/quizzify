// src/app/api/duels/[code]/arena/state/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DuelStatus, RoundState } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const sess = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      status: true, // DuelStatus
      rounds: {
        select: {
          id: true,
          roundNo: true,
          state: true,        // RoundState
          timerSec: true,
          startedAt: true,
          questionCardId: true,
        },
        orderBy: { roundNo: "desc" },
        take: 1,
      },
    },
  });

  if (!sess) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Default snapshot fields
  let phase: "lobby" | "question" | "resolving" | "summary" = "lobby";
  let roundNo = 1;
  let timeLimit = 15;
  let remaining: number | undefined = undefined;

  if (sess.status === DuelStatus.ENDED) {
    phase = "summary";
  }

  const round = sess.rounds[0];
  if (round) {
    roundNo = round.roundNo ?? 1;
    timeLimit = round.timerSec ?? 15;

    if (sess.status !== DuelStatus.ENDED) {
      if (round.state === RoundState.LIVE) phase = "question";
      else if (round.state === RoundState.RESOLVED) phase = "resolving";
      else phase = "lobby"; // PAIRING or pre-live
    }

    if (phase === "question" && round.startedAt && timeLimit) {
      const elapsedSec = Math.floor((Date.now() - round.startedAt.getTime()) / 1000);
      remaining = Math.max(0, timeLimit - elapsedSec);
    }
  } else {
    phase = sess.status === DuelStatus.ENDED ? "summary" : "lobby";
  }

  return NextResponse.json({
    phase,
    round: roundNo,
    timeLimit,
    ...(remaining !== undefined ? { remaining } : {}),
    // question/options can be added later if you join to Card
  });
}
