// /src/app/api/library/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/library?ownerId=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerId = url.searchParams.get("ownerId") || "";
    if (!ownerId) {
      return NextResponse.json({ error: "Missing ownerId." }, { status: 400 });
    }

    // Recent sets owned by the user
    const recentSets = await prisma.studySet.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,
        createdAt: true,
        owner: { select: { id: true, username: true, avatar: true } },
        _count: { select: { cards: true, likedBy: true } },
      },
    });

    // All sets owned by the user
    const allSets = await prisma.studySet.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,
        createdAt: true,
        owner: { select: { id: true, username: true, avatar: true } },
        _count: { select: { cards: true, likedBy: true } },
      },
    });

    // Liked sets by this user — ONLY public sets
    // (Creators will still see their own private sets in recent/all, but not here)
    const likedSets = await prisma.studySet.findMany({
      where: {
        isPublic: true,
        likedBy: { some: { userId: ownerId } }, // 👈 requires Like relation
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,
        createdAt: true,
        owner: { select: { id: true, username: true, avatar: true } },
        _count: { select: { cards: true, likedBy: true } },
      },
    });

    // Folders owned by the user
    const folders = await prisma.folder.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { sets: true } },
      },
    });

    return NextResponse.json({ recentSets, allSets, likedSets, folders }, { status: 200 });
  } catch (err) {
    console.error("GET /api/library error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}