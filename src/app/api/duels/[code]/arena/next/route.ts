// src/app/api/duels/[code]/arena/next/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastRoundStart } from "../_helpers";

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const sess = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true, setId: true, status: true,
      rounds: { select: { id: true, state: true }, orderBy: { roundNo: "desc" }, take: 1 },
    },
  });
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sess.status !== "RUNNING") return NextResponse.json({ error: "Game not running" }, { status: 400 });

  // If last round is LIVE, do nothing
  const last = sess.rounds[0];
  if (last && last.state === "LIVE") {
    return NextResponse.json({ ok: true, message: "Already live" });
  }

  // Pick next question card id (prefer one not used yet)
  const usedIds = await prisma.duelRound.findMany({
    where: { sessionId: sess.id },
    select: { questionCardId: true },
  });
  const used = new Set(usedIds.map((x) => x.questionCardId));
  const cards = await prisma.card.findMany({
    where: { setId: sess.setId },
    select: { id: true },
  });
  if (cards.length === 0) return NextResponse.json({ error: "No cards in set" }, { status: 400 });

  let target = cards.find((c) => !used.has(c.id)) ?? cards[0];

  const count = await prisma.duelRound.count({ where: { sessionId: sess.id } });
  const timerSec = 20; // or read from sess.options?.timerSec

  const created = await prisma.duelRound.create({
    data: {
      sessionId: sess.id,
      roundNo: count + 1,
      questionCardId: target.id,
      timerSec,
      state: "LIVE",
      startedAt: new Date(),
    },
  });

  await broadcastRoundStart(sess.id, created as any, sess.setId);
  return NextResponse.json({ ok: true, roundId: created.id });
}
