// /src/app/api/duels/[code]/score/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, ctx: { params: { code: string } }) {
  try {
    const { code } = ctx.params;
    const body = await req.json().catch(() => ({} as any));
    const playerId = String(body?.playerId || "");
    const deltaRaw = body?.delta ?? 1;
    const delta = Number.isFinite(Number(deltaRaw)) ? Number(deltaRaw) : 1;

    if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

    const session = await prisma.duelSession.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!session?.id) return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });

    const player = await prisma.duelPlayer.findUnique({
      where: { id: playerId },
      select: { id: true, sessionId: true },
    });
    if (!player || player.sessionId !== session.id) {
      return NextResponse.json({ error: "PLAYER_NOT_IN_SESSION" }, { status: 400 });
    }

    const updated = await prisma.duelPlayer.update({
      where: { id: playerId },
      data: { score: { increment: delta } },
      select: { id: true, score: true },
    });

    return NextResponse.json({ ok: true, score: updated.score });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "score-failed" }, { status: 500 });
  }
}
