// /src/app/api/users/[handle]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/[handle]
 * - [handle] can be a username (case-insensitive, with or without leading "@")
 *   or a user id.
 * - Returns public-safe profile info + a few recent public sets with like counts.
 */
export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const raw = (params.handle || "").trim();
    const handle = raw.startsWith("@") ? raw.slice(1) : raw;
    if (!handle) {
      return NextResponse.json({ error: "Missing handle." }, { status: 400 });
    }

    // 1) Try id lookup first
    let user =
      (await prisma.user.findUnique({
        where: { id: handle },
        select: { id: true, email: true, username: true, avatar: true, createdAt: true },
      })) ||
      // 2) Fallback to username (case-insensitive)
      (await prisma.user.findFirst({
        where: { username: { equals: handle, mode: "insensitive" } },
        select: { id: true, email: true, username: true, avatar: true, createdAt: true },
      }));

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Public sets for the profile
    const recentPublicSets = await prisma.studySet.findMany({
      where: { ownerId: user.id, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,
        createdAt: true,
        owner: { select: { id: true, username: true, avatar: true } },
        _count: { select: { likedBy: true, cards: true } },
      },
    });

    // Stats (simple, fast counts)
    const [totalPublicSets, totalLikesReceived] = await Promise.all([
      prisma.studySet.count({ where: { ownerId: user.id, isPublic: true } }),
      prisma.like.count({ where: { set: { ownerId: user.id, isPublic: true } } }),
    ]);

    // (Optional placeholders for future features)
    const stats = {
      totalPublicSets,
      totalLikesReceived,
      // streak, calendar, classes will be added later
    };

    return NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
        stats,
        recentSets: recentPublicSets.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          isPublic: s.isPublic,
          createdAt: s.createdAt,
          owner: s.owner,
          likeCount: s._count.likedBy,
          cardCount: s._count.cards,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/users/[handle] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
