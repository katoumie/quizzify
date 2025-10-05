// /src/app/api/duels/[code]/start/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, DuelStatus, DuelPlayerRole } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = String(params.code || "");
  const { userId } = await req.json().catch(() => ({}));

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing userId (host required)" }, { status: 400 });
  }

  // Load session + players
  const session = await prisma.duelSession.findUnique({
    where: { code },
    include: {
      players: {
        select: { id: true, role: true },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.hostId !== String(userId)) {
    return NextResponse.json({ error: "Only the host can start the game." }, { status: 403 });
  }

  if (session.status === "RUNNING") {
    // Idempotent
    return NextResponse.json({ ok: true, status: "RUNNING", startedAt: session.startedAt ?? null });
  }
  if (session.status === "CANCELLED") {
    return NextResponse.json({ error: "Session is cancelled." }, { status: 400 });
  }

  const now = new Date();

  // Count non-spectators for this run
  const activeIds = session.players
    .filter((p) => p.role !== ("SPECTATOR" as DuelPlayerRole))
    .map((p) => p.id);
  const initialCount = activeIds.length;

  // Do everything atomically
  await prisma.$transaction(async (tx) => {
    // 1) Stamp fresh startedAt and flip status to RUNNING
    await tx.duelSession.update({
      where: { id: session.id },
      data: {
        status: "RUNNING" as DuelStatus,
        startedAt: now,
        initialPlayerCount: initialCount,
      },
    });

    // 2) Reset per-run flags for non-spectators (no lives/eliminated anymore)
    if (activeIds.length > 0) {
      await tx.duelPlayer.updateMany({
        where: { id: { in: activeIds } },
        data: {
          isFinished: false,
          finishedAt: null,
          score: 0,
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    status: "RUNNING",
    startedAt: now.toISOString(),
    initialPlayerCount: initialCount,
  });
}
