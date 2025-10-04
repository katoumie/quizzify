// src/app/api/duels/[code]/me/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Best-effort "who am I?" for a session.
 * - If you have auth wired, resolve by userId.
 * - If not, just reply { playerId: null } with 200 to avoid noisy 401s.
 *   The client already falls back to localStorage.
 */

// TODO: replace with your actual auth lookup (NextAuth, custom JWT, etc.)
async function getCurrentUserId(): Promise<string | null> {
  // Example for later:
  // const session = await getServerSession(authOptions);
  // return session?.user?.id ?? null;
  return null;
}

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const userId = await getCurrentUserId();

  // If auth is not wired yet, don't 401—return a null payload.
  if (!userId) {
    return NextResponse.json({ playerId: null }, { status: 200 });
  }

  const session = await prisma.duelSession.findUnique({
    where: { code: params.code },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ playerId: null }, { status: 200 });

  const player = await prisma.duelPlayer.findFirst({
    where: { sessionId: session.id, userId, eliminatedAt: null },
    orderBy: { connectedAt: "desc" }, // last (re)connection is the current record
    select: { id: true },
  });

  return NextResponse.json({ playerId: player?.id ?? null }, { status: 200 });
}
