// src/app/api/duels/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function genCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1/O/I
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function normMode(input?: string) {
  const m = String(input || "").toUpperCase();
  if (m === "TEAM" || m === "STANDARD") return m;
  return "ARENA";
}

export async function POST(req: Request) {
  try {
    const { setId, hostId, mode, options } = await req.json();

    const set = await prisma.studySet.findUnique({
      where: { id: String(setId) },
      select: { id: true, ownerId: true },
    });
    if (!set) {
      return NextResponse.json({ error: "Study set not found." }, { status: 404 });
    }

    // If hostId not provided, fall back to the set owner
    const resolvedHostId = hostId ? String(hostId) : set.ownerId;
    const host = await prisma.user.findUnique({
      where: { id: resolvedHostId },
      select: { id: true, username: true, email: true },
    });
    if (!host) {
      return NextResponse.json({ error: "Host user not found." }, { status: 400 });
    }

    const code = genCode();

    const session = await prisma.duelSession.create({
      data: {
        code,
        hostId: host.id,
        setId: set.id,
        mode: normMode(mode) as any,
        options: options ?? {},
        initialPlayerCount: 0,
      },
      select: { id: true, code: true, hostId: true },
    });

    // Create the host player once (idempotent-ish)
    await prisma.duelPlayer
      .create({
        data: {
          sessionId: session.id,
          userId: host.id,
          displayName: host.username || (host.email ? host.email.split("@")[0] : "Host"),
          lives: 3,
        },
      })
      .catch(() => {});

    return NextResponse.json({ id: session.id, code: session.code });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Failed to create lobby." }, { status: 500 });
  }
}
