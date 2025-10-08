// /src/app/api/classes/resolve/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").trim();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const cls = await prisma.class.findFirst({
      where: { joinCode: code },
      select: { id: true, name: true },
    });

    if (!cls) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });

    return NextResponse.json({ id: cls.id, name: cls.name });
  } catch (err) {
    console.error("GET /api/classes/resolve error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
