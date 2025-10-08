// /src/app/api/classes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

function mapLite(c: any) {
  return {
    id: c.id,
    name: c.name,
    ownerId: c.ownerId,
    owner: c.owner ? { id: c.owner.id, username: c.owner.username, avatar: c.owner.avatar } : null,
    memberCount: c._count?.members ?? undefined,
    setCount: c._count?.sets ?? undefined,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function randomCode(len = 7) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
async function generateUniqueJoinCode() {
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const exists = await prisma.class.findFirst({ where: { joinCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  const code = randomCode(10);
  return code;
}

/** GET /api/classes?mine=1  ->  { teaching:[], enrolled:[] } */
export async function GET(req: Request) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const mine = url.searchParams.get("mine");
    if (!mine) {
      return NextResponse.json({ error: "Missing or unsupported query." }, { status: 400 });
    }

    const [teaching, enrolled] = await Promise.all([
      prisma.class.findMany({
        where: { members: { some: { userId: uid, role: "TEACHER" } } },
        include: { owner: { select: { id: true, username: true, avatar: true } }, _count: { select: { members: true, sets: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.class.findMany({
        where: { members: { some: { userId: uid, role: "STUDENT" } } },
        include: { owner: { select: { id: true, username: true, avatar: true } }, _count: { select: { members: true, sets: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ teaching: teaching.map(mapLite), enrolled: enrolled.map(mapLite) });
  } catch (err) {
    console.error("GET /api/classes error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/classes  { name }  ->  { id }  (teacher/admin only) */
export async function POST(req: Request) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Class name is required." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only teachers can create classes." }, { status: 403 });
    }

    const joinCode = await generateUniqueJoinCode();

    const created = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: { name: name.slice(0, 120), ownerId: uid, joinCode },
        select: { id: true },
      });
      await tx.classMember.create({ data: { classId: cls.id, userId: uid, role: "TEACHER" } });
      return cls;
    });

    return NextResponse.json({ id: created.id }, { status: 200 });
  } catch (err) {
    console.error("POST /api/classes error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
