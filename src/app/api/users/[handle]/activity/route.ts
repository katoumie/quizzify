// /src/app/api/users/[handle]/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// helpers
function ymd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function firstOfMonth(year: number, month1based: number) {
  return new Date(Date.UTC(year, month1based - 1, 1));
}
function nextMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}

export async function GET(
  req: NextRequest,
  context: RouteContext<"/api/users/[handle]/activity">
) {
  try {
    const { handle } = await context.params;

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getUTCFullYear();
    const month = Number(searchParams.get("month")) || now.getUTCMonth() + 1; // 1..12

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: handle, mode: "insensitive" } },
          { id: handle },
        ],
      },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const start = firstOfMonth(year, month);
    const until = nextMonth(start);

    // month data
    const rows = await prisma.studyActivity.findMany({
      where: { userId: user.id, date: { gte: start, lt: until } },
      select: { date: true, studied: true },
      orderBy: { date: "asc" },
    });

    const days = rows.map((r) => ({
      dateISO: ymd(new Date(r.date)),
      studied: r.studied,
    }));

    // simple current streak (last 90 days, counting back from today UTC)
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const ninetyAgo = addDays(todayUTC, -90);
    const recent = await prisma.studyActivity.findMany({
      where: { userId: user.id, date: { gte: ninetyAgo, lte: todayUTC } },
      select: { date: true },
      orderBy: { date: "desc" },
    });
    const set = new Set(recent.map((r) => ymd(new Date(r.date))));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const iso = ymd(addDays(todayUTC, -i));
      if (set.has(iso)) streak++;
      else break;
    }

    return NextResponse.json(
      {
        year,
        month, // 1..12
        todayISO: ymd(todayUTC),
        days, // [{ dateISO, studied }]
        currentStreakDays: streak,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/users/[handle]/activity error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
