export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await ctx.params;
    const { playerId, userId, displayName } = await req.json();

    const session = await prisma.duelSession.findUnique({
      where: { code },
      select: { id: true, code: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Reuse existing player if provided/known
    let player =
      (playerId
        ? await prisma.duelPlayer.findUnique({ where: { id: playerId } })
        : null) ||
      (userId
        ? await prisma.duelPlayer.findFirst({
            where: { sessionId: session.id, userId },
          })
        : null);

    // Create if needed
    if (!player) {
      player = await prisma.duelPlayer.create({
        data: {
          sessionId: session.id,
          userId: userId ?? null,
          displayName: displayName || "Player",
          lives: 3,
          score: 0,
          isReady: false,
          byeCount: 0,
        },
      });
    } else if (displayName && displayName !== player.displayName) {
      player = await prisma.duelPlayer.update({
        where: { id: player.id },
        data: { displayName },
      });
    }

    // Return + broadcast with nested user fields so avatars show up immediately
    const joined = await prisma.duelPlayer.findUnique({
      where: { id: player.id },
      select: {
        id: true,
        userId: true,
        displayName: true,
        team: true,
        lives: true,
        score: true,
        isReady: true,
        eliminatedAt: true,
        user: { select: { avatar: true, username: true } },
      },
    });

    // 1) Point event (append-friendly UIs)
    duelsBus.publish(session.id,   { type: "join", player: joined });
    duelsBus.publish(session.code, { type: "join", player: joined });

    // 2) Full snapshot (reconcile any missed point events)
    const snap = await prisma.duelSession.findUnique({
      where: { id: session.id },
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
            user: { select: { avatar: true, username: true } },
          },
          orderBy: { connectedAt: "asc" },
        },
      },
    });
    if (snap) {
      duelsBus.publish(session.id,   { type: "snapshot", payload: snap });
      duelsBus.publish(session.code, { type: "snapshot", payload: snap });
    }

    return NextResponse.json(joined);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Failed to join." },
      { status: 500 }
    );
  }
}
