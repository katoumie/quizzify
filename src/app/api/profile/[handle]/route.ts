// /src/app/api/profile/[handle]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Return YYYY-MM-DD for a Date as UTC (no TZ drift). */
function ymdUTC(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** Today in UTC as YYYY-MM-DD */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add (or subtract) whole days to a YYYY-MM-DD in UTC, return YYYY-MM-DD. */
function addDaysUTC(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return ymdUTC(d);
}

/** Compute *consecutive* streak up to *today in UTC* using a set of YYYY-MM-DD strings. */
function calcStreakUTC(dates: string[]): number {
  if (!dates?.length) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cursor = todayUTC();
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysUTC(cursor, -1);
  }
  return streak;
}

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const handle = params.handle;

    // Find by username (case-insensitive) or by id as fallback
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: handle, mode: "insensitive" } },
          { id: handle },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Recent public sets (shape matches SetCardData)
    const recentSets = await prisma.studySet.findMany({
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
        _count: { select: { likedBy: true } },
      },
    });

    // Total likes across all sets owned by this user
    const totalLikes = await prisma.like.count({
      where: { set: { ownerId: user.id } },
    });

    // Friends: placeholder unless you already have a Friend model
    const friendsCount = 0;

    // --- Study dates: prefer StudyActivity (DATE), also include StudyDay (DateTime) if present
    const acts = await prisma.studyActivity
      .findMany({
        where: { userId: user.id },
        select: { date: true },
        orderBy: { date: "asc" },
      })
      .catch(() => [] as { date: Date }[]);

    const days = await prisma.studyDay
      .findMany({
        where: { userId: user.id },
        select: { day: true },
        orderBy: { day: "asc" },
      })
      .catch(() => [] as { day: Date }[]);

    // Normalize to YYYY-MM-DD (UTC) and de-dup
    const ymds = new Set<string>();
    for (const a of acts) ymds.add(ymdUTC(a.date));
    for (const d of days) ymds.add(ymdUTC(d.day));

    const studiedDates = Array.from(ymds).sort(); // ascending YYYY-MM-DD
    const streakDays = calcStreakUTC(studiedDates);

    // --- Badge showcase (ordered up to 8)
    const showcaseRows = await prisma.userBadge
      .findMany({
        where: { userId: user.id, showcased: true },
        orderBy: [{ showcaseOrder: "asc" }, { badgeKey: "asc" }],
        select: { badgeKey: true },
        take: 8,
      })
      .catch(() => [] as { badgeKey: string }[]);

    return NextResponse.json(
      {
        user,
        studiedDates,
        friendsCount,
        streakDays,
        totalLikes,
        showcase: showcaseRows.map((r) => r.badgeKey), // 👈 added for Badge Showcase grid
        recentSets: recentSets.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          isPublic: s.isPublic,
          createdAt: s.createdAt,
          owner: s.owner,
          likeCount: s._count.likedBy,
        })),
        recentClasses: [], // keep for future
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/profile/[handle] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
