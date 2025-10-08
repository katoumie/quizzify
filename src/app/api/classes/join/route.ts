// /src/app/api/classes/join/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const code = String(body?.code || "").toUpperCase().trim();
    if (!code) return NextResponse.json({ error: "Invite code is required." }, { status: 400 });

    const cls = await prisma.class.findFirst({
      where: { joinCode: code, isActive: true },
      select: { id: true },
    });
    if (!cls) return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });

    // Upsert membership as STUDENT
    await prisma.classMember.upsert({
      where: { classId_userId: { classId: cls.id, userId: uid } },
      update: { role: "STUDENT" },
      create: { classId: cls.id, userId: uid, role: "STUDENT" },
    });

    return NextResponse.json({ id: cls.id }, { status: 200 });
  } catch (err) {
    console.error("POST /api/classes/join error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
