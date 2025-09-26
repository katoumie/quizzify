// /src/app/api/sets/[id]/recommendations/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BKT, nextReviewDateFrom } from "@/lib/bkt";
import type { BKTParams } from "@/lib/bkt";

export const runtime = "nodejs";
// Ensure no caching (recommendations change with time)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Narrow types for our select payloads (keeps TS happy even if Prisma types are not inferred)
type CardRow = {
  id: string;
  inheritDefault: boolean;
  skills: { skillId: string }[];
};

type SetRow = {
  id: string;
  defaultSkillId: string | null;
  cards: CardRow[];
};

type BKTParamRow = {
  skillId: string;
  pInit: number;
  pTransit: number;
  slip: number;
  guess: number;
  forget: number | null;
};

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const setId: string = ctx.params.id;
    const url = new URL(req.url);
    const userId: string = url.searchParams.get("userId") ?? "";

    if (!setId || !userId) {
      return NextResponse.json({ cardIds: [] }, { status: 200 });
    }

    // Pull the set (effective skills come from explicit card skill, else defaultSkill if inheritDefault)
    const set = (await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        id: true,
        defaultSkillId: true,
        cards: {
          orderBy: { createdAt: "asc" }, // keep it simple; remove 'position' if not in your schema
          select: {
            id: true,
            inheritDefault: true,
            skills: { select: { skillId: true } },
          },
        },
      },
    })) as SetRow | null;

    if (!set) {
      return NextResponse.json({ cardIds: [] }, { status: 200 });
    }

    // Effective skill per card (first explicit else default if inherited)
    const effSkillId: Record<string, string | null> = {};
    const skillSet = new Set<string>();
    for (const c of set.cards) {
      const sId: string | null =
        (c.skills[0]?.skillId as string | undefined) ??
        (c.inheritDefault ? set.defaultSkillId ?? null : null);
      effSkillId[c.id] = sId;
      if (sId) skillSet.add(sId);
    }

    const skillIds: string[] = Array.from(skillSet);
    const cardIds: string[] = set.cards.map((c) => c.id);

    // Mastery & parameter sources
    const [cardM, skillM, bktParams] = await Promise.all([
      prisma.userCardMastery.findMany({
        where: { userId, cardId: { in: cardIds } },
        select: { cardId: true, pKnow: true, updatedAt: true },
      }),
      prisma.userSkillMastery.findMany({
        where: { userId, skillId: { in: skillIds } },
        select: { skillId: true, pKnow: true, updatedAt: true },
      }),
      prisma.bKTParams.findMany({
        where: { skillId: { in: skillIds } },
        select: {
          skillId: true,
          pInit: true,
          pTransit: true,
          slip: true,
          guess: true,
          forget: true,
        },
      }),
    ]);

    const cardP = new Map<string, number>(cardM.map((m) => [m.cardId, m.pKnow]));
    const skillP = new Map<string, number>(skillM.map((m) => [m.skillId, m.pKnow]));
    const paramMap = new Map<string, BKTParamRow>(
      (bktParams as BKTParamRow[]).map((p) => [p.skillId, p])
    );

    // Last response per card → anchor for due date when item-level updatedAt isn't sufficient
    const lastByCard = await prisma.response.groupBy({
      by: ["cardId"],
      where: { userId, cardId: { in: cardIds } },
      _max: { createdAt: true },
    });
    const lastSeenCard = new Map<string, Date | null>(
      lastByCard.map((r) => [r.cardId as string, (r._max.createdAt as Date) ?? null])
    );

    const now = new Date();
    const recommended: string[] = [];

    for (const c of set.cards) {
      const sId = effSkillId[c.id];

      // Build the BKTParams for this card from its effective skill; fall back to DEFAULT_BKT
      const row = sId ? paramMap.get(sId) ?? null : null;
      const pSettings: BKTParams = row
        ? {
            pInit: row.pInit,
            pTransit: row.pTransit,
            slip: row.slip,
            guess: row.guess,
            forget: row.forget,
          }
        : DEFAULT_BKT;

      // Choose a pKnow: prefer card-level → skill-level → pInit
      const pKnow: number =
        cardP.get(c.id) ??
        (sId ? skillP.get(sId) ?? pSettings.pInit : pSettings.pInit);

      // Anchor time: last response on this card or now
      const anchor: Date = lastSeenCard.get(c.id) ?? now;

      // Threshold: 0.72 is a common recall target; you can bump to 0.8 if you prefer
      const { next } = nextReviewDateFrom(pKnow, pSettings, 0.72, anchor);

      if (+next <= +now) {
        recommended.push(c.id);
      }
    }

    return NextResponse.json({ cardIds: recommended }, { status: 200 });
  } catch (err) {
    console.error("GET /api/sets/[id]/recommendations error:", err);
    return NextResponse.json({ cardIds: [] }, { status: 200 });
  }
}
