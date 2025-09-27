// src/app/api/duels/[code]/arena/state/route.ts
import { NextResponse } from "next/server";
import { arenaSnapshot } from "../_helpers";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const snap = await arenaSnapshot(code);
  if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snap);
}
