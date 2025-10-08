// /src/app/api/classes/[id]/sets/[setId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; setId: string } }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const classId = params?.id;
    const setId = params?.setId;
    if (!classId || !setId) {
      return NextResponse.json({ error: "Missing class or set id" }, { status: 400 });
    }

    // Must be class owner or teacher member
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, ownerId: true },
    });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const isOwner = cls.ownerId === userId;
    let isTeacher = false;
    if (!isOwner) {
      const mem = await prisma.classMember.findUnique({
        where: { classId_userId: { classId, userId } },
        select: { role: true },
      });
      isTeacher = mem?.role === "TEACHER";
    }
    if (!isOwner && !isTeacher) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await prisma.classSet.deleteMany({
      where: { classId, setId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Set not assigned to this class" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/classes/[id]/sets/[setId] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
