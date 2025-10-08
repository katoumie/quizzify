// /src/app/api/classes/[id]/invite/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

function randomCode(len = 7) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
async function uniqueCode() {
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const exists = await prisma.class.findFirst({ where: { joinCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Could not generate code");
}

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = ctx.params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Only owner (or teacher member) may rotate invite; here we enforce owner
    const cls = await prisma.class.findUnique({
      where: { id },
      select: { id: true, ownerId: true, isActive: true },
    });
    if (!cls || !cls.isActive) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (cls.ownerId !== uid) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const code = await uniqueCode();
    await prisma.class.update({ where: { id }, data: { joinCode: code } });

    return NextResponse.json({ joinCode: code }, { status: 200 });
  } catch (err) {
    console.error("POST /api/classes/[id]/invite error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
