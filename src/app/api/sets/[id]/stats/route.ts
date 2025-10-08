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
  inheritDefault: boolean;
  skills: { skillId: string; skill: { name: string } }[];
};
type SetRow = {
  defaultSkillId: string | null;
  cards: CardRow[];
};

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const setId = id;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? "";

    if (!setId || !userId) {
      return NextResponse.json(
        { skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { reason: "missing setId/userId" } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Load set: cards & skills (mapping is ONLY from this set)
    const set = (await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        defaultSkillId: true,
        cards: {
          select: {
            id: true,
            inheritDefault: true,
            skills: { select: { skillId: true, skill: { select: { name: true } } } },
          },
        },
      },
    })) as SetRow | null;

    if (!set) {
      return NextResponse.json(
        { skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { reason: "set not found" } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Build mapping strictly from this set
    const cardToSkills = new Map<string, string[]>();
    const skillName = new Map<string, string>();

    if (set.defaultSkillId) {
      const sk = await prisma.skill.findUnique({ where: { id: set.defaultSkillId }, select: { name: true } });
      if (sk?.name) skillName.set(set.defaultSkillId, sk.name);
    }

    for (const c of set.cards) {
      if (c.skills.length) {
        const sids = c.skills.map((s) => {
          skillName.set(s.skillId, s.skill.name);
          return s.skillId;
        });
        cardToSkills.set(c.id, sids);
      } else if (c.inheritDefault && set.defaultSkillId) {
        cardToSkills.set(c.id, [set.defaultSkillId]);
      } else {
        cardToSkills.set(c.id, []);
      }
    }

    const presentSkillIds = [...new Set(Array.from(cardToSkills.values()).flat())];
    if (presentSkillIds.length === 0) {
      return NextResponse.json(
        { skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { reason: "no skills mapped in this set" } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const cardIds = set.cards.map((c) => c.id);

    // Pull responses for THIS user on THIS set's cards only
    const responses = await prisma.response.findMany({
      where: { userId, cardId: { in: cardIds } },
      orderBy: { createdAt: "asc" },
      select: { cardId: true, createdAt: true, correct: true },
    });

    // Build per-skill sequences, mapping via this set only (ignore r.skillId)
    type Ev = { correct: boolean; createdAt: Date };
    const perSkill = new Map<string, Ev[]>();
    const seen = new Set<string>(); // `${sid}|${cardId}|${createdAtSec}`

    for (const r of responses) {
      const createdAt = new Date(r.createdAt as unknown as Date);
      const tSec = Math.floor(createdAt.getTime() / 1000);
      const mappedSids = r.cardId ? (cardToSkills.get(r.cardId) ?? []) : [];

      for (const sid of mappedSids) {
        const key = `${sid}|${r.cardId ?? "?"}|${tSec}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const arr = perSkill.get(sid) ?? [];
        arr.push({ correct: r.correct, createdAt });
        perSkill.set(sid, arr);
      }
    }

    // BKT parameters per skill
    const paramRows = await prisma.bKTParams.findMany({
      where: { skillId: { in: presentSkillIds } },
      select: { skillId: true, pInit: true, pTransit: true, slip: true, guess: true, forget: true },
    });
    const paramMap = new Map<string, BKTParams>(
      paramRows.map((p) => [p.skillId, { pInit: p.pInit, pTransit: p.pTransit, slip: p.slip, guess: p.guess, forget: p.forget }])
    );

    // 7-day correctness
    const since = new Date(Date.now() - 7 * DAY);
    const cw7 = new Map<string, { c: number; w: number }>();
    for (const sid of presentSkillIds) {
      const seq = perSkill.get(sid) ?? [];
      for (const ev of seq) {
        if (ev.createdAt < since) continue;
        const agg = cw7.get(sid) ?? { c: 0, w: 0 };
        if (ev.correct) agg.c++; else agg.w++;
        cw7.set(sid, agg);
      }
    }

    // Compute per-skill mastery: ALWAYS start from pInit (no stored fallback)
    const skillRows = presentSkillIds.map((sid) => {
      const seq = (perSkill.get(sid) ?? []).slice().sort((a, b) => +a.createdAt - +b.createdAt);
      const settings: BKTParams = paramMap.get(sid) ?? DEFAULT_BKT;

      let p = settings.pInit;
      let lastAt: Date | null = null;
      let streak = 0;

      for (const ev of seq) {
        if (lastAt) {
          const gapDays = Math.max(0, Math.floor((+ev.createdAt - +lastAt) / DAY));
          if (gapDays > 0) p = projectWithForgetting(p, gapDays, settings.forget ?? undefined);
        }
        p = posteriorGivenObs(p, ev.correct, settings);
        lastAt = ev.createdAt;
        streak = ev.correct ? streak + 1 : 0;
      }

      p = clamp01(p);

      // Next review
      const anchor = lastAt ?? new Date();
      const { next } = nextReviewDateFrom(p, settings, 0.72, anchor);

      return {
        skillId: sid,
        skillName: skillName.get(sid) ?? "Skill",
        pKnow: p,
        masteryAchieved: p >= 0.95,
        nextReviewAt: next.toISOString(),
        correct7: cw7.get(sid)?.c ?? 0,
        wrong7: cw7.get(sid)?.w ?? 0,

        // debug
        __debug_respCount_dedup: (perSkill.get(sid) ?? []).length,
        __debug_lastAt: lastAt ? lastAt.toISOString() : null,
        __debug_forget: settings.forget ?? null,
        __debug_streak: streak,
        __debug_startFrom: "pInit",
      };
    });

    // Totals
    const nextTimes = skillRows
      .map((s) => (s.nextReviewAt ? new Date(s.nextReviewAt).getTime() : Number.POSITIVE_INFINITY))
      .filter((n) => Number.isFinite(n));
    const totals = {
      skills: skillRows.length,
      mastered: skillRows.filter((s) => s.masteryAchieved).length,
      nextDueAt: nextTimes.length ? new Date(Math.min(...nextTimes)).toISOString() : null,
    };

    return NextResponse.json(
      { skills: skillRows, totals, debug: { now: new Date().toISOString() } },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/sets/[id]/stats error:", err);
    return NextResponse.json(
      { skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { error: String(err) } },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
