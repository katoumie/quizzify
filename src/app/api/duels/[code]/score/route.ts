// /src/app/api/duels/[code]/score/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = String(params.code);
  const { playerId, delta } = await req.json().catch(() => ({}));

  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
  }

  const session = await prisma.duelSession.findUnique({ where: { code } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.duelPlayer.update({
    where: { id: String(playerId) },
    data: { score: { increment: Number(delta ?? 1) } },
  });

  return NextResponse.json({ ok: true });
}
