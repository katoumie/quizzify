import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** YYYY-MM-DD in UTC */
function ymdUTC(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysUTC(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return ymdUTC(d);
}
function calcStreakUTC(dates: string[]): number {
  if (!dates?.length) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cur = todayUTC();
  while (set.has(cur)) {
    streak += 1;
    cur = addDaysUTC(cur, -1);
  }
  return streak;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Study dates from both tables (DATE + DateTime at UTC)
    const acts = await prisma.studyActivity
      .findMany({ where: { userId }, select: { date: true }, orderBy: { date: "asc" } })
      .catch(() => [] as { date: Date }[]);
    const days = await prisma.studyDay
      .findMany({ where: { userId }, select: { day: true }, orderBy: { day: "asc" } })
      .catch(() => [] as { day: Date }[]);

    const dates = new Set<string>();
    for (const a of acts) dates.add(ymdUTC(a.date));
    for (const d of days) dates.add(ymdUTC(d.day));

    const studiedDates = Array.from(dates).sort();
    const streakDays = calcStreakUTC(studiedDates);

    // Totals
    const totalLikes = await prisma.like.count({
      where: { set: { ownerId: userId } },
    });
    const friendsCount = 0; // placeholder

    // Unlock logic (simple, stats-based)
    const unlocked: string[] = [];
    const s = streakDays;
    if (s >= 3) unlocked.push("rookie-streaker");
    if (s >= 7) unlocked.push("weekly-warrior");
    if (s >= 14) unlocked.push("fortnight-focus");
    if (s >= 30) unlocked.push("one-month-marathoner");
    if (s >= 100) unlocked.push("unstoppable");
    if (s >= 365) unlocked.push("yearly-legend");
    // Night Owl / Early Bird depend on time-of-day events; skip for now.

    // Current showcase (ordered)
    const showcaseRows = await prisma.userBadge
      .findMany({
        where: { userId, showcased: true },
        orderBy: [{ showcaseOrder: "asc" }, { badgeKey: "asc" }],
        select: { badgeKey: true },
        take: 8,
      })
      .catch(() => [] as { badgeKey: string }[]);
    const showcase = showcaseRows.map((r) => r.badgeKey);

    return NextResponse.json(
      {
        stats: { streakDays, totalLikes, friendsCount },
        unlocked,
        showcase,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/achievements/me error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
