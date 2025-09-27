// src/app/api/duels/[code]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;

    const snap = await prisma.duelSession.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        hostId: true,
        mode: true,
        status: true,
        options: true,
        players: {
          select: {
            id: true,
            userId: true,
            displayName: true,
            team: true,
            lives: true,
            score: true,
            isReady: true,
            eliminatedAt: true,
            user: { select: { avatar: true, username: true } }, // <-- include avatar/username
          },
          orderBy: { connectedAt: "asc" },
        },
      },
    });

    if (!snap) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json(snap);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Failed to load session." }, { status: 500 });
  }
}
