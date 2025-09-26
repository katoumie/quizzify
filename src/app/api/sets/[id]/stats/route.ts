// /src/app/api/sets/[id]/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
// Ensure no caching anywhere
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY = 24 * 60 * 60 * 1000;

/* ──────────────────────────────────────────────────────────────────────
   Utilities
────────────────────────────────────────────────────────────────────── */
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// Accepts 0..1 or 0..100
function normalizePk(p: unknown): number {
  const v = Number(p ?? 0);
  if (!Number.isFinite(v)) return 0;
  return v > 1.000001 ? clamp01(v / 100) : clamp01(v);
}

function intervalDaysFor(p: number, streak: number): number {
  let base =
    p < 0.60 ? 1 :
    p < 0.75 ? 2 :
    p < 0.85 ? 4 :
    p < 0.95 ? 7 : 14;
  if (p >= 0.95) base += Math.min(Math.max(streak, 0), 8) * 2;
  return Math.min(Math.max(base, 1), 45);
}

function applyForgetting(p: number, gapDays: number, forgetPerDay = 0.02) {
  if (!Number.isFinite(gapDays) || gapDays <= 0) return p;
  const f = Math.pow(1 - Math.max(0, Math.min(forgetPerDay, 0.2)), gapDays);
  return clamp01(p * f);
}

// Tiny BKT over a sequence
function bktFromResponses(
  seq: { correct: boolean; createdAt: Date }[],
  opts?: { p0?: number; learn?: number; guess?: number; slip?: number; forgetPerDay?: number }
): { pKnow: number; lastAt: Date | null; streak: number } {
  const p0    = opts?.p0    ?? 0.20;
  const learn = opts?.learn ?? 0.15;
  const guess = opts?.guess ?? 0.20;
  const slip  = opts?.slip  ?? 0.10;
  const forgetPerDay = opts?.forgetPerDay ?? 0.02;

  if (!seq.length) return { pKnow: p0, lastAt: null, streak: 0 };

  let p = p0;
  let lastAt: Date | null = null;
  let streak = 0;
  const rows = [...seq].sort((a, b) => +a.createdAt - +b.createdAt);

  for (const r of rows) {
    if (lastAt) p = applyForgetting(p, (+r.createdAt - +lastAt) / DAY, forgetPerDay);

    const pC_L  = 1 - slip;
    const pC_nL = guess;
    const denomC = p * pC_L + (1 - p) * pC_nL || 1e-9;

    if (r.correct) {
      p = (p * pC_L) / denomC;
      streak += 1;
    } else {
      const pW_L  = slip;
      const pW_nL = 1 - guess;
      const denomW = p * pW_L + (1 - p) * pW_nL || 1e-9;
      p = (p * pW_L) / denomW;
      streak = 0;
    }

    p = p + (1 - p) * learn; // learning transition
    lastAt = r.createdAt;
  }

  return { pKnow: clamp01(p), lastAt, streak };
}

/* ──────────────────────────────────────────────────────────────────────
   GET /api/sets/[id]/stats
────────────────────────────────────────────────────────────────────── */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const setId = params.id;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? "";

    if (!setId || !userId) {
      return NextResponse.json({ skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { reason: "missing setId/userId" } }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    // Load set: cards & skills
    const set = await prisma.studySet.findUnique({
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
    });
    if (!set) {
      return NextResponse.json({ skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { reason: "set not found" } }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    // Build cardId -> skillIds & skillId -> name
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
    const cardIds = set.cards.map((c) => c.id);

    if (!presentSkillIds.length) {
      return NextResponse.json({ skills: [], totals: { skills: 0, mastered: 0, nextDueAt: null }, debug: { reason: "no present skills" } }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    // Pull responses for this user. We tolerate either skillId or cardId being set.
    const responses = await prisma.response.findMany({
      where: {
        userId,
        OR: [
          { skillId: { in: presentSkillIds } },
          { cardId: { in: cardIds } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, cardId: true, skillId: true, createdAt: true, correct: true },
    });

    // Group per skill, deriving from cardId if skillId missing
    const perSkill = new Map<string, { correct: boolean; createdAt: Date }[]>();
    for (const r of responses) {
      const sids =
        (r.skillId && presentSkillIds.includes(r.skillId)) ? [r.skillId]
        : (r.cardId ? (cardToSkills.get(r.cardId) ?? []) : []);

      for (const sid of sids) {
        const arr = perSkill.get(sid) ?? [];
        arr.push({ correct: r.correct, createdAt: r.createdAt as unknown as Date });
        perSkill.set(sid, arr);
      }
    }

    // Stored mastery as prior
    const stored = await prisma.userSkillMastery.findMany({
      where: { userId, skillId: { in: presentSkillIds } },
      select: { skillId: true, pKnow: true },
    });
    const prior = new Map(stored.map((m) => [m.skillId, normalizePk(m.pKnow)]));

    // 7d correctness
    const since = new Date(Date.now() - 7 * DAY);
    const cw7 = new Map<string, { c: number; w: number }>();
    for (const r of responses) {
      if (r.createdAt < since) continue;
      const sids =
        (r.skillId && presentSkillIds.includes(r.skillId)) ? [r.skillId]
        : (r.cardId ? (cardToSkills.get(r.cardId) ?? []) : []);
      for (const sid of sids) {
        const agg = cw7.get(sid) ?? { c: 0, w: 0 };
        if (r.correct) agg.c++; else agg.w++;
        cw7.set(sid, agg);
      }
    }

    // Compute per skill
    const skillRows = presentSkillIds.map((sid) => {
      const seq = perSkill.get(sid) ?? [];
      const { pKnow, lastAt, streak } = bktFromResponses(seq, { p0: prior.get(sid) ?? 0.20 });
      const days = intervalDaysFor(pKnow, streak);
      const base = lastAt ?? new Date(); // if truly brand-new, schedule from now + interval
      const next = new Date(base.getTime() + days * DAY);

      return {
        skillId: sid,
        skillName: skillName.get(sid) ?? "Skill",
        pKnow,
        masteryAchieved: pKnow >= 0.95,
        nextReviewAt: next.toISOString(),
        correct7: cw7.get(sid)?.c ?? 0,
        wrong7: cw7.get(sid)?.w ?? 0,

        // DEBUG so you can see what's happening in Network panel:
        __debug_respCount: seq.length,
        __debug_lastAt: lastAt ? lastAt.toISOString() : null,
        __debug_streak: streak,
        __debug_priorP0: prior.get(sid) ?? 0.20,
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
      { skills: skillRows, totals, debug: { presentSkillIds, cardIds, responseCount: responses.length, now: new Date().toISOString() } },
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
