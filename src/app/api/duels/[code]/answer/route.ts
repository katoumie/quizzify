// /src/app/api/duels/[code]/answer/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, RoundState } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Records a single answer with its response time.
 * Expects: { playerId: string, isCorrect: boolean, responseMs: number, questionId?: string }
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = String(params.code || "");
  const { playerId, isCorrect, responseMs, questionId } = await req.json().catch(() => ({}));

  if (!code || !playerId || typeof isCorrect !== "boolean" || typeof responseMs !== "number") {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const session = await prisma.duelSession.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status !== "RUNNING") {
    return NextResponse.json({ error: "Session not running" }, { status: 400 });
  }

  // Create a simple "round" container row so DuelAnswer has a foreign key.
  // (No pairing logic; we just increment round number.)
  const roundNo = (await prisma.duelRound.count({ where: { sessionId: session.id } })) + 1;

  const round = await prisma.duelRound.create({
    data: {
      sessionId: session.id,
      roundNo,
      questionCardId: String(questionId ?? `adhoc-${roundNo}`),
      timerSec: 0,
      state: "RESOLVED" as RoundState,
      startedAt: new Date(),
      endedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.duelAnswer.create({
    data: {
      roundId: round.id,
      playerId: String(playerId),
      choiceIndex: 0,
      isCorrect: !!isCorrect,
      responseMs: Math.max(0, Math.round(responseMs)),
    },
  });

  return NextResponse.json({ ok: true });
}
