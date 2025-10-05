// src/app/api/duels/[code]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: { code: string } }
) {
  const { code } = ctx.params;

  // Find session by its human-facing code
  const session = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      status: true,
      setId: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(session);
}
