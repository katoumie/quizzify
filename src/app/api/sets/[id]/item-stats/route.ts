// /src/app/api/sets/[id]/item-stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BKT, nextReviewDateFrom } from "@/lib/bkt";
import type { BKTParams } from "@/lib/bkt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY = 86400000;

type CardRow = {
  id: string;
  term: string | null;
  definition: string | null;
  inheritDefault: boolean;
  createdAt: Date;
  skills: { skillId: string; skill: { name: string } }[];
};

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const setId: string = ctx.params.id;
    const url = new URL(req.url);
    const userId: string = url.searchParams.get("userId") ?? "";

    if (!setId || !userId) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        defaultSkillId: true,
        cards: {
          select: {
            id: true,
            term: true,
            definition: true,
            inheritDefault: true,
            createdAt: true,
            skills: { select: { skillId: true, skill: { select: { name: true } } } },
          },
        },
      },
    });

    if (!set) return NextResponse.json({ items: [] }, { status: 200 });

    let defaultSkillName: string | null = null;
    if (set.defaultSkillId) {
      const sk = await prisma.skill.findUnique({ where: { id: set.defaultSkillId }, select: { name: true } });
      defaultSkillName = sk?.name ?? null;
    }

    const cards = set.cards as CardRow[];
    const items = cards.map((c) => {
      const explicit = c.skills[0]?.skillId ?? null;
      const effSkillId = explicit ?? (c.inheritDefault ? set.defaultSkillId ?? null : null);
      const effSkillName = explicit
        ? c.skills[0]!.skill.name
        : (c.inheritDefault ? (defaultSkillName ?? "Default Skill") : "Uncategorized");
      return {
        id: c.id,
        term: c.term ?? "",
        effSkillId,
        effSkillName,
        createdAt: c.createdAt,
      };
    });

    const skillIds = Array.from(new Set(items.map(i => i.effSkillId).filter((x): x is string => !!x)));
    const cardIds = items.map(i => i.id);

    // Mastery and BKT params
    const [cardM, skillM, paramRows] = await Promise.all([
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
        select: { skillId: true, pInit: true, pTransit: true, slip: true, guess: true, forget: true },
      }),
    ]);

    const cardP = new Map<string, number>(cardM.map(m => [m.cardId, m.pKnow]));
    const skillP = new Map<string, number>(skillM.map(m => [m.skillId, m.pKnow]));
    const paramMap = new Map<string, BKTParams>(
      paramRows.map(p => [p.skillId, { pInit: p.pInit, pTransit: p.pTransit, slip: p.slip, guess: p.guess, forget: p.forget }])
    );

    // Last seen + 7d counts per card
    const responses = await prisma.response.findMany({
      where: { userId, cardId: { in: cardIds } },
      select: { cardId: true, correct: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const lastSeen = new Map<string, Date>();
    const agg7 = new Map<string, { c: number; w: number }>();
    const since = new Date(Date.now() - 7 * DAY);

    for (const r of responses) {
      const t = r.createdAt as unknown as Date;
      const prev = lastSeen.get(r.cardId);
      if (!prev || +t > +prev) lastSeen.set(r.cardId, t);
      if (+t >= +since) {
        const x = agg7.get(r.cardId) ?? { c: 0, w: 0 };
        if (r.correct) x.c++; else x.w++;
        agg7.set(r.cardId, x);
      }
    }

    const now = new Date();
    const out = items.map(it => {
      const sId = it.effSkillId;
      const settings: BKTParams = sId ? (paramMap.get(sId) ?? DEFAULT_BKT) : DEFAULT_BKT;
      const pKnow = cardP.get(it.id) ?? (sId ? (skillP.get(sId) ?? settings.pInit) : settings.pInit);
      const anchor = lastSeen.get(it.id) ?? now;
      const { next } = nextReviewDateFrom(pKnow, settings, 0.72, anchor);
      const cw = agg7.get(it.id) ?? { c: 0, w: 0 };
      return {
        cardId: it.id,
        term: it.term,
        skillName: it.effSkillName ?? "Skill",
        pKnow,
        lastSeenAt: lastSeen.get(it.id)?.toISOString() ?? null,
        nextReviewAt: next.toISOString(),
        correct7: cw.c,
        wrong7: cw.w,
      };
    });

    return NextResponse.json({ items: out }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/sets/[id]/item-stats error:", err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
