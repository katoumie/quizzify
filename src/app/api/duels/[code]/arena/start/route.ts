// src/app/api/duels/[code]/arena/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startArena } from "../_helpers";
import { duelsBus } from "@/lib/duels-bus";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await prisma.duelSession.findUnique({
      where: { code: params.code },
      select: { id: true, code: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const result = await startArena(session.id);

    // Broadcast "start" to all clients listening in the lobby
    const payload = {
      type: "start",
      roundNo: result.roundNo,
      roundId: result.roundId,
      questionCardId: result.questionCardId,
    };
    duelsBus.publish(session.id, payload);
    duelsBus.publish(session.code, payload);

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      roundNo: result.roundNo,
      roundId: result.roundId,
      state: "PAIRING",
      pairs: result.pairs,
      questionCardId: result.questionCardId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to start Arena." },
      { status: 400 }
    );
  }
}
