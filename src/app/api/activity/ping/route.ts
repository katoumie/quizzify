// /src/app/api/activity/ping/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Body: { userId: string, weight?: number, dateISO?: "YYYY-MM-DD" } */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    const weight = Number.isFinite(body?.weight) ? Number(body.weight) : 1;

    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

    let date = body?.dateISO
      ? new Date(`${body.dateISO}T00:00:00.000Z`)
      : new Date(); // we will clamp to date-only below

    // clamp to UTC date-only; Prisma column is @db.Date
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const row = await prisma.studyActivity.upsert({
      where: { userId_date: { userId, date: dateOnly } }, // uses @@unique([userId, date])
      create: { userId, date: dateOnly, studied: weight },
      update: { studied: { increment: weight } },
      select: { studied: true },
    });

    return NextResponse.json({ ok: true, studiedForDay: row.studied }, { status: 200 });
  } catch (err) {
    console.error("POST /api/activity/ping error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
