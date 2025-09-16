// /src/app/api/users/[handle]/activity/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// helpers
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
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
  req: Request,
  { params }: { params: { handle: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getUTCFullYear();
    const month = Number(searchParams.get("month")) || new Date().getUTCMonth() + 1; // 1..12

    const user = await prisma.user.findUnique({
      where: { username: params.handle },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const start = firstOfMonth(year, month);
    const until = nextMonth(start);

    // month data
    const rows = await prisma.studyActivity.findMany({
      where: { userId: user.id, date: { gte: start, lt: until } },
      select: { date: true, studied: true },
      orderBy: { date: "asc" },
    });

    const days = rows.map(r => ({
      dateISO: ymd(new Date(r.date)),
      studied: r.studied,
    }));

    // simple current streak (last 90 days, counting back from today)
    const todayUTC = new Date();
    const ninetyAgo = addDays(todayUTC, -90);
    const recent = await prisma.studyActivity.findMany({
      where: { userId: user.id, date: { gte: ninetyAgo, lte: todayUTC } },
      select: { date: true },
      orderBy: { date: "desc" },
    });
    const set = new Set(recent.map(r => ymd(new Date(r.date))));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const iso = ymd(addDays(todayUTC, -i));
      if (set.has(iso)) streak++;
      else break;
    }

    return NextResponse.json({
      year,
      month,                 // 1..12
      todayISO: ymd(todayUTC),
      days,                  // [{dateISO, studied}]
      currentStreakDays: streak,
    });
  } catch (err) {
    console.error("GET /api/users/[handle]/activity error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
