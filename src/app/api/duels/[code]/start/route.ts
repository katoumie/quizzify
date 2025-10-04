// src/app/api/duels/[code]/start/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const sess =
    (await prisma.duelSession.findUnique({ where: { code }, select: { id: true, code: true } })) ??
    (await prisma.duelSession.findUnique({ where: { id: code }, select: { id: true, code: true } }));

  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Broadcast a simple redirect signal understood by the lobby page
  const payload = { type: "go-arena" as const };
  duelsBus.publish(sess.id, payload);
  duelsBus.publish(sess.code, payload);

  return NextResponse.json({ ok: true });
}
