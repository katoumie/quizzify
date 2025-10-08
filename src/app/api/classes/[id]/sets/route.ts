// /src/app/api/classes/[id]/sets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const classId = ctx.params?.id;
    const body = await req.json().catch(() => ({} as any));
    const setId = String(body?.setId || "").trim();

    if (!classId || !setId) {
      return NextResponse.json({ error: "Missing classId or setId." }, { status: 400 });
    }

    // Caller must be a TEACHER member of this class
    const member = await prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: uid } },
      select: { role: true },
    });
    if (!member || member.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Ensure set exists and belongs to caller (v1 constraint to avoid assigning others’ private sets)
    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: { id: true, ownerId: true },
    });
    if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });
    if (set.ownerId !== uid) {
      return NextResponse.json({ error: "You can only assign sets you own (v1)." }, { status: 403 });
    }

    // Upsert attachment
    await prisma.classSet.upsert({
      where: { classId_setId: { classId, setId } },
      update: { assignedById: uid, assignedAt: new Date() },
      create: { classId, setId, assignedById: uid },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/classes/[id]/sets error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
