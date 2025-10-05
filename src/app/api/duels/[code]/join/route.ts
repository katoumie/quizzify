// /src/app/api/duels/[code]/join/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function looksLikeCuidish(s?: string | null) {
  return !!s && /^[a-z0-9]{24,32}$/.test(s) && s[0] === "c";
}

/**
 * Idempotent join:
 * - If userId provided: ensure one DuelPlayer per (sessionId, userId).
 *   If a pre-seeded row exists with userId = null (common for host), link it,
 *   then clean up other anonymous dupes.
 * - If guest: dedupe by displayName within the last minute.
 * - displayName rules:
 *   - signed-in: use provided displayName if sent; otherwise default to username (or email local-part) or "Player"
 *   - guest: must provide (we fallback to "Player")
 */
export async function POST(req: Request, ctx: { params: { code: string } }) {
  try {
    const { code } = ctx.params;
    const body = await req.json().catch(() => ({} as any));
    const userId: string | undefined = body?.userId || undefined;
    const displayNameSent: string | undefined =
      typeof body?.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : undefined;

    const session = await prisma.duelSession.findUnique({
      where: { code },
      select: { id: true, hostId: true, status: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
    }

    // Build a sensible default name for signed-in users if none was sent
    let defaultSignedInName: string | undefined = undefined;
    if (userId) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true },
      });
      const candidate = u?.username?.trim() || (u?.email ? u.email.split("@")[0] : "");
      defaultSignedInName = candidate && !looksLikeCuidish(candidate) ? candidate : undefined;
    }

    const displayName =
      (displayNameSent && !looksLikeCuidish(displayNameSent) ? displayNameSent : undefined) ??
      defaultSignedInName ??
      "Player";

    let playerId: string;

    if (userId) {
      // 1) Find by (sessionId, userId)
      let existing = await prisma.duelPlayer.findFirst({
        where: { sessionId: session.id, userId },
        select: { id: true },
      });

      // 2) If none and this user is the host, link the oldest anonymous row
      if (!existing && session.hostId === userId) {
        const orphan = await prisma.duelPlayer.findFirst({
          where: { sessionId: session.id, userId: null },
          orderBy: { connectedAt: "asc" },
          select: { id: true },
        });
        if (orphan) {
          await prisma.duelPlayer.update({
            where: { id: orphan.id },
            data: { userId },
          });
          existing = { id: orphan.id };

          // Clean up other anonymous rows, if any
          await prisma.duelPlayer.deleteMany({
            where: { sessionId: session.id, userId: null, NOT: { id: orphan.id } },
          });
        }
      }

      if (existing) {
        await prisma.duelPlayer.update({
          where: { id: existing.id },
          data: {
            displayName,
            lastSeenAt: new Date(),
            connectedAt: new Date(),
          },
        });
        playerId = existing.id;
      } else {
        const created = await prisma.duelPlayer.create({
          data: {
            sessionId: session.id,
            userId,
            displayName,
            isReady: false,
            connectedAt: new Date(),
          },
          select: { id: true },
        });
        playerId = created.id;
      }
    } else {
      // Guest path: dedupe by same displayName within 60s
      const guestName = displayName || "Player";
      const recent = await prisma.duelPlayer.findFirst({
        where: { sessionId: session.id, userId: null, displayName: guestName },
        orderBy: { connectedAt: "desc" },
        select: { id: true, connectedAt: true },
      });

      if (recent && Date.now() - new Date(recent.connectedAt).getTime() < 60_000) {
        await prisma.duelPlayer.update({
          where: { id: recent.id },
          data: { lastSeenAt: new Date(), connectedAt: new Date(), displayName: guestName },
        });
        playerId = recent.id;
      } else {
        const created = await prisma.duelPlayer.create({
          data: {
            sessionId: session.id,
            userId: null,
            displayName: guestName,
            isReady: false,
            connectedAt: new Date(),
          },
          select: { id: true },
        });
        playerId = created.id;
      }
    }

    // Return playerId so the client can post score/answers
    return NextResponse.json({ ok: true, playerId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Join failed." }, { status: 500 });
  }
}
