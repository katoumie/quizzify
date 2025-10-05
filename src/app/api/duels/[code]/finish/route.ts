// /src/app/api/duels/[code]/finish/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, ctx: { params: { code: string } }) {
  const { code } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const playerId = String(body?.playerId ?? "");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const session = await prisma.duelSession.findUnique({ where: { code }, select: { id: true } });
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  await prisma.duelPlayer.update({
    where: { id: playerId },
    data: { isFinished: true, finishedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}