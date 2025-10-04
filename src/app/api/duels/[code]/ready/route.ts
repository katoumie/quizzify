export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const { playerId, ready } = await req.json();

  if (!playerId || typeof ready !== "boolean") {
    return NextResponse.json({ error: "Missing playerId or ready" }, { status: 400 });
  }

  let session =
    (await prisma.duelSession.findUnique({ where: { code }, select: { id: true, code: true } })) ??
    (await prisma.duelSession.findUnique({ where: { id: code }, select: { id: true, code: true } }));

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await prisma.duelPlayer.update({ where: { id: playerId }, data: { isReady: ready } });

  duelsBus.publish(session.id,   { type: "READY", playerId, ready });
  duelsBus.publish(session.code, { type: "READY", playerId, ready });

  return NextResponse.json({ ok: true });
}
