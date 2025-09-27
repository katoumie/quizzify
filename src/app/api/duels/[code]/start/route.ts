export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { force, playerId } = await req.json();

    // Accept both id or code in the path
    const sess =
      (await prisma.duelSession.findUnique({
        where: { code },
        select: { id: true, code: true, hostId: true },
      })) ||
      (await prisma.duelSession.findUnique({
        where: { id: code },
        select: { id: true, code: true, hostId: true },
      }));

    if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Optional: verify caller is host
    if (playerId) {
      const caller = await prisma.duelPlayer.findUnique({
        where: { id: playerId },
        select: { userId: true, sessionId: true },
      });
      if (!caller || caller.sessionId !== sess.id || caller.userId !== sess.hostId) {
        return NextResponse.json({ error: "Only the host can start the game." }, { status: 403 });
      }
    }

    if (!force) {
      const unready = await prisma.duelPlayer.count({
        where: {
          sessionId: sess.id,
          OR: [{ userId: null }, { userId: { not: sess.hostId } }],
          isReady: false,
        },
      });
      if (unready > 0) {
        return NextResponse.json({ error: "All non-host players must be ready." }, { status: 400 });
      }
    }

    await prisma.duelSession.update({
      where: { id: sess.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    duelsBus.publish(sess.id,   { type: "start" });
    duelsBus.publish(sess.code, { type: "start" });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Failed to start." }, { status: 500 });
  }
}
