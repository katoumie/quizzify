// /src/app/api/classes/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

/* =========================
   GET: class detail
   ========================= */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = ctx.params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, avatar: true } },
        _count: { select: { members: true, sets: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        sets: {
          include: {
            set: {
              select: {
                id: true,
                title: true,
                description: true,
                isPublic: true,
                createdAt: true,
                updatedAt: true,
                owner: { select: { id: true, username: true, avatar: true } },
                _count: { select: { cards: true, likedBy: true } },
              },
            },
            // scalars come automatically (assignedAt, dueAt)
            assignedBy: { select: { id: true, username: true } },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const myMembership = await prisma.classMember.findUnique({
      where: { classId_userId: { classId: id, userId: uid } },
      select: { role: true },
    });

    return NextResponse.json({
      id: cls.id,
      name: cls.name,
      owner: cls.owner,
      ownerId: cls.ownerId,
      isActive: cls.isActive,
      joinCode: cls.joinCode,
      counts: { members: cls._count.members, sets: cls._count.sets },
      role: myMembership?.role ?? null, // "TEACHER" | "STUDENT" | null
      members: cls.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      sets: cls.sets.map((cs) => ({
        id: cs.set.id,
        title: cs.set.title,
        description: cs.set.description ?? "",
        isPublic: cs.set.isPublic,
        createdAt: cs.set.createdAt,
        updatedAt: cs.set.updatedAt,
        owner: cs.set.owner,
        termCount: cs.set._count.cards ?? 0,
        likeCount: cs.set._count.likedBy ?? 0,
        assignedAt: cs.assignedAt,
        dueAt: cs.dueAt,
        assignedBy: cs.assignedBy ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/classes/[id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* =========================
   PATCH: rename class (owner only)
   Body: { name: string }
   ========================= */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = ctx.params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    const nextName = (body?.name ?? "").toString().trim();
    if (!nextName) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const cls = await prisma.class.findUnique({ where: { id }, select: { ownerId: true } });
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cls.ownerId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.class.update({
      where: { id },
      data: { name: nextName.slice(0, 120) },
      select: { id: true, name: true },
    });

    return NextResponse.json({ ok: true, id: updated.id, name: updated.name });
  } catch (err) {
    console.error("PATCH /api/classes/[id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* =========================
   DELETE: delete class (owner only)
   ========================= */
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = ctx.params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const cls = await prisma.class.findUnique({ where: { id }, select: { ownerId: true } });
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cls.ownerId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.class.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("DELETE /api/classes/[id] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
