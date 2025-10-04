// /src/app/api/duels/[code]/start/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Start a duel session:
 * - Only the host can start.
 * - Sets status=RUNNING and startedAt=now.
 * - Records initialPlayerCount.
 */
export async function POST(req: Request, ctx: { params: { code: string } }) {
  try {
    const { code } = ctx.params;
    const body = await req.json().catch(() => ({} as any));
    const userId: string | undefined = body?.userId || undefined;

    const session = await prisma.duelSession.findUnique({
      where: { code },
      select: { id: true, hostId: true, status: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
    }

    if (!userId || session.hostId !== userId) {
      return NextResponse.json({ error: "Only the host can start the session." }, { status: 403 });
    }

    if (session.status !== "LOBBY") {
      return NextResponse.json({ error: "Session is not in lobby state." }, { status: 400 });
    }

    const count = await prisma.duelPlayer.count({
      where: { sessionId: session.id },
    });

    const updated = await prisma.duelSession.update({
      where: { id: session.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        initialPlayerCount: count,
      },
      select: { id: true, status: true, startedAt: true },
    });

    return NextResponse.json({ ok: true, session: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to start session." }, { status: 500 });
  }
}
