// /src/app/api/sets/[id]/item-stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BKT,
  posteriorGivenObs,
  projectWithForgetting,
  nextReviewDateFrom,
} from "@/lib/bkt";
import type { BKTParams } from "@/lib/bkt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY = 86_400_000;

type CardRow = {
  id: string;
  term: string;
  inheritDefault: boolean;
  skills: { skillId: string; skill: { name: string } }[];
};
type SetRow = {
  defaultSkillId: string | null;
  cards: CardRow[];
};

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const setId = params.id;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? "";

    if (!setId || !userId) {
      return NextResponse.json({ items: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    // 1) Load this set's cards + skills (mapping is STRICTLY from this set)
    const set = (await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        defaultSkillId: true,
        cards: {
          select: {
            id: true,
            term: true,
            inheritDefault: true,
            skills: { select: { skillId: true, skill: { select: { name: true } } } },
          },
        },
      },
    })) as SetRow | null;

    if (!set) return NextResponse.json({ items: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });

    // Build card -> skill (first only, MVP) + names
    const cardPrimarySkill = new Map<string, string | null>();
    const skillName = new Map<string, string>();
    for (const c of set.cards) {
      if (c.skills.length) {
        const s = c.skills[0];
        cardPrimarySkill.set(c.id, s.skillId);
        skillName.set(s.skillId, s.skill.name);
      } else if (c.inheritDefault && set.defaultSkillId) {
        cardPrimarySkill.set(c.id, set.defaultSkillId);
      } else {
        cardPrimarySkill.set(c.id, null);
      }
    }

    const presentSkillIds = [...new Set(Array.from(cardPrimarySkill.values()).filter(Boolean))] as string[];

    // 2) Fetch responses for THIS user on THIS set's cards only
    const cardIds = set.cards.map(c => c.id);
    const responses = await prisma.response.findMany({
      where: { userId, cardId: { in: cardIds } },
      orderBy: { createdAt: "asc" },
      select: { cardId: true, createdAt: true, correct: true },
    });

    // 3) Per-card sequences (dedup by second)
    type Ev = { correct: boolean; createdAt: Date };
    const byCard = new Map<string, Ev[]>();
    const seen = new Set<string>(); // `${cardId}|${tSec}`
    for (const r of responses) {
      const createdAt = new Date(r.createdAt as unknown as Date);
      const key = `${r.cardId}|${Math.floor(createdAt.getTime() / 1000)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const arr = byCard.get(r.cardId) ?? [];
      arr.push({ correct: r.correct, createdAt });
      byCard.set(r.cardId, arr);
    }

    // 4) Skill-specific BKT params
    const paramRows = presentSkillIds.length
      ? await prisma.bKTParams.findMany({
          where: { skillId: { in: presentSkillIds } },
          select: { skillId: true, pInit: true, pTransit: true, slip: true, guess: true, forget: true },
        })
      : [];
    const paramMap = new Map<string, BKTParams>(
      paramRows.map((p) => [
        p.skillId,
        { pInit: p.pInit, pTransit: p.pTransit, slip: p.slip, guess: p.guess, forget: p.forget },
      ])
    );

    // 5) Compute per-card mastery strictly from sequences (no stored fallback)
    const now = new Date();
    const since = new Date(+now - 7 * DAY);

    const items = set.cards.map((c) => {
      const seq = (byCard.get(c.id) ?? []).slice().sort((a, b) => +a.createdAt - +b.createdAt);
      const sid = cardPrimarySkill.get(c.id) ?? null;
      const settings: BKTParams = (sid && paramMap.get(sid)) || DEFAULT_BKT;

      let p = settings.pInit;
      let lastAt: Date | null = null;
      let c7 = 0, w7 = 0;

      for (const ev of seq) {
        if (lastAt) {
          const gapDays = Math.max(0, Math.floor((+ev.createdAt - +lastAt) / DAY));
          if (gapDays > 0) p = projectWithForgetting(p, gapDays, settings.forget ?? undefined);
        }
        p = posteriorGivenObs(p, ev.correct, settings);
        if (ev.createdAt >= since) {
          if (ev.correct) c7++; else w7++;
        }
        lastAt = ev.createdAt;
      }

      p = clamp01(p);
      const anchor = lastAt ?? now;
      const { next } = nextReviewDateFrom(p, settings, 0.72, anchor);

      return {
        cardId: c.id,
        term: c.term,
        skillName: sid ? (skillName.get(sid) ?? "Skill") : "Unassigned",
        pKnow: p,
        lastSeenAt: lastAt ? lastAt.toISOString() : null,
        nextReviewAt: next.toISOString(),
        correct7: c7,
        wrong7: w7,
      };
    });

    return NextResponse.json({ items }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/sets/[id]/item-stats error:", err);
    return NextResponse.json({ items: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}