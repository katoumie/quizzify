// src/app/api/duels/[code]/arena/resolve/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastRoundResolve } from "../_helpers";

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const sess = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true, setId: true,
      rounds: {
        select: { id: true, state: true, timerSec: true, startedAt: true, sessionId: true, questionCardId: true, roundNo: true, endedAt: true },
        orderBy: { roundNo: "desc" }, take: 1,
      },
    },
  });
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const r = sess.rounds[0];
  if (!r || r.state !== "LIVE") return NextResponse.json({ ok: true, message: "No live round" });

  // Mark resolved
  const upd = await prisma.duelRound.update({
    where: { id: r.id },
    data: { state: "RESOLVED", endedAt: new Date() },
  });

  await broadcastRoundResolve(sess.id, upd as any, sess.setId);
  return NextResponse.json({ ok: true });
}
