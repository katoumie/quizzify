// /src/app/api/duels/[code]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, DuelPlayerRole, DuelStatus } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const code = String(params.code);

  const session = await prisma.duelSession.findUnique({
    where: { code },
    include: {
      players: {
        include: { user: { select: { username: true, avatar: true } } },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    code: session.code,
    setId: session.setId,
    status: session.status as DuelStatus,
    initialPlayerCount: session.initialPlayerCount,
    startedAt: session.startedAt,
    players: session.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.user?.username ?? null,
      displayName: p.displayName,
      avatar: p.user?.avatar ?? null,
      role: p.role as DuelPlayerRole,
      lives: p.lives,
      score: p.score,
      isReady: p.isReady,
      connectedAt: p.connectedAt,
      lastSeenAt: p.lastSeenAt,
      eliminatedAt: p.eliminatedAt,
      isFinished: p.isFinished,
      finishedAt: p.finishedAt,
    })),
  });
}
