//src/app/api/skills/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerId = url.searchParams.get("ownerId");
    if (!ownerId) {
      return NextResponse.json({ error: "Missing ownerId." }, { status: 400 });
    }

    const rows = await prisma.userSkill.findMany({
      where: { userId: ownerId },
      include: { skill: { select: { name: true } } },
    });

    const names = rows
      .map((r) => r.skill?.name)
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return NextResponse.json({ skills: names }, { status: 200 });
  } catch (err) {
    console.error("GET /api/skills error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}