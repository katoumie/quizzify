// /src/app/api/profile/[handle]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Minimal badge metadata so the profile page can render showcase items */
const BADGE_META: Record<
  string,
  { title: string; iconSrc: string }
> = {
  // ---- Streaks ----
  "rookie-streaker": { title: "Rookie Streaker", iconSrc: "/badges/rookie-streaker.svg" },
  "weekly-warrior": { title: "Weekly Warrior", iconSrc: "/badges/weekly-warrior.svg" },
  "fortnight-focus": { title: "Fortnight Focus", iconSrc: "/badges/fortnight-focus.svg" },
  "one-month-marathoner": { title: "One-Month Marathoner", iconSrc: "/badges/one-month-marathoner.svg" },
  "unstoppable": { title: "Unstoppable", iconSrc: "/badges/unstoppable.svg" },
  "yearly-legend": { title: "Yearly Legend", iconSrc: "/badges/yearly-legend.svg" },
  "night-owl": { title: "Night Owl", iconSrc: "/badges/night-owl.svg" },
  "early-bird": { title: "Early Bird", iconSrc: "/badges/early-bird.svg" },
  // ---- Duels ----
  "first-blood": { title: "First Blood", iconSrc: "/badges/first-blood.svg" },
  "comeback-kid": { title: "Comeback Kid", iconSrc: "/badges/comeback-kid.svg" },
  "flawless-victory": { title: "Flawless Victory", iconSrc: "/badges/flawless-victory.svg" },
  "duelist-apprentice": { title: "Duelist Apprentice", iconSrc: "/badges/duelist-apprentice.svg" },
  "arena-champion": { title: "Arena Champion", iconSrc: "/badges/arena-champion.svg" },
  "legend-of-the-arena": { title: "Legend of the Arena", iconSrc: "/badges/legend-of-the-arena.svg" },
  "friendly-fire": { title: "Friendly Fire", iconSrc: "/badges/friendly-fire.svg" },
  // ---- Progress ----
  "getting-started": { title: "Getting Started", iconSrc: "/badges/getting-started.svg" },
  "quiz-master": { title: "Quiz Master", iconSrc: "/badges/quiz-master.svg" },
  "perfectionist": { title: "Perfectionist", iconSrc: "/badges/perfectionist.svg" },
  "flashcard-fanatic": { title: "Flashcard Fanatic", iconSrc: "/badges/flashcard-fanatic.svg" },
  "set-explorer": { title: "Set Explorer", iconSrc: "/badges/set-explorer.svg" },
  "library-builder": { title: "Library Builder", iconSrc: "/badges/library-builder.svg" },
  scholar: { title: "Scholar", iconSrc: "/badges/scholar.svg" },
  sage: { title: "Sage", iconSrc: "/badges/sage.svg" },
  // ---- Milestones ----
  "first-set-conqueror": { title: "First Set Conqueror", iconSrc: "/badges/first-set-conqueror.svg" },
  collector: { title: "Collector", iconSrc: "/badges/collector.svg" },
  "achievement-hunter": { title: "Achievement Hunter", iconSrc: "/badges/achievement-hunter.svg" },
  "badge-master": { title: "Badge Master", iconSrc: "/badges/badge-master.svg" },
  "legendary-scholar": { title: "Legendary Scholar", iconSrc: "/badges/legendary-scholar.svg" },
  // ---- Profile ----
  "first-steps": { title: "First Steps", iconSrc: "/badges/first-steps.svg" },
  "style-setter": { title: "Style Setter", iconSrc: "/badges/style-setter.svg" },
  "social-learner": { title: "Social Learner", iconSrc: "/badges/social-learner.svg" },
  supporter: { title: "Supporter", iconSrc: "/badges/supporter.svg" },
  // ---- Popularity ----
  "rising-star": { title: "Rising Star", iconSrc: "/badges/rising-star.svg" },
  trendsetter: { title: "Trendsetter", iconSrc: "/badges/trendsetter.svg" },
  "legendary-creator": { title: "Legendary Creator", iconSrc: "/badges/legendary-creator.svg" },
};

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
/** Compute consecutive streak up to today (UTC) using a set of YYYY-MM-DD strings. */
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
  _req: NextRequest,
  context: RouteContext<"/api/profile/[handle]">
) {
  try {
    const { handle } = await context.params;

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

    const studiedDates = Array.from(ymds).sort();
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

    const showcaseKeys = showcaseRows.map((r) => r.badgeKey);
    const badgeShowcase = showcaseKeys.map((key) => {
      const meta = BADGE_META[key];
      return {
        key,
        title: meta?.title ?? key,
        iconSrc: meta?.iconSrc ?? `/badges/${key}.svg`,
      };
    });

    return NextResponse.json(
      {
        user,
        studiedDates,
        friendsCount,
        streakDays,
        totalLikes,
        // For older clients:
        showcase: showcaseKeys,
        // For the current profile page:
        badgeShowcase,
        recentSets: recentSets.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ?? "",
          isPublic: s.isPublic,
          createdAt: s.createdAt,
          owner: s.owner,
          likeCount: s._count.likedBy,
        })),
        recentClasses: [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/profile/[handle] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
