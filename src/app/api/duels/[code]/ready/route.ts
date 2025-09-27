export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params; // IMPORTANT: await params
  const { playerId, ready } = await req.json();

  if (!playerId || typeof ready !== "boolean") {
    return NextResponse.json(
      { error: "Missing playerId or ready" },
      { status: 400 }
    );
  }

  // Try treat the path param as a lobby code first
  let session =
    await prisma.duelSession.findUnique({
      where: { code },
      select: { id: true, code: true },
    }) ||
    // If not found, fall back to treating it as the session id
    await prisma.duelSession.findUnique({
      where: { id: code },
      select: { id: true, code: true },
    });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await prisma.duelPlayer.update({
    where: { id: playerId },
    data: { isReady: ready },
  });

  // Notify all subscribers (SSE) on BOTH keys
  duelsBus.publish(session.id,   { type: "ready", playerId, ready });
  duelsBus.publish(session.code, { type: "ready", playerId, ready });

  return NextResponse.json({ ok: true });
}
