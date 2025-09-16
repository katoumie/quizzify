import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = { userId?: string; badgeKeys?: string[] };

export async function POST(req: Request) {
  try {
    const { userId, badgeKeys }: Body = await req.json().catch(() => ({} as Body));
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    const keys = Array.isArray(badgeKeys) ? badgeKeys.filter((k): k is string => typeof k === "string") : [];
    if (keys.length > 8) {
      return NextResponse.json({ error: "You can showcase up to 8 badges." }, { status: 400 });
    }
    // de-dup & trim
    const unique = Array.from(new Set(keys.map((k) => k.trim())));

    await prisma.$transaction(async (tx) => {
      // Clear showcase flags
      await tx.userBadge.updateMany({
        where: { userId },
        data: { showcased: false, showcaseOrder: null },
      });

      // Upsert each showcased badge with its order
      for (let i = 0; i < unique.length; i++) {
        const badgeKey = unique[i];
        await tx.userBadge.upsert({
          where: { userId_badgeKey: { userId, badgeKey } },
          create: { userId, badgeKey, showcased: true, showcaseOrder: i },
          update: { showcased: true, showcaseOrder: i },
        });
      }
    });

    return NextResponse.json({ ok: true, showcase: unique }, { status: 200 });
  } catch (err) {
    console.error("POST /api/achievements/showcase error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
