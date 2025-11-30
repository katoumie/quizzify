// /src/app/api/classes/[id]/sets/[setId]/item-stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";
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
  term: string; // adjust if your field name differs
  inheritDefault: boolean;
  skills: { skillId: string; skill: { name: string } }[];
};
type SetRow = {
  defaultSkillId: string | null;
  cards: CardRow[];
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Ev = { correct: boolean; createdAt: Date };

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; setId: string }> }
) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, setId } = await ctx.params;
    const classId = id;

    if (!classId || !setId) {
      return NextResponse.json(
        { items: [], debug: { reason: "missing classId/setId" } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Ensure caller is a TEACHER in this class
    const membership = await prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: uid } },
      select: { role: true },
    });

    if (!membership || membership.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all student members in this class
    const studentMembers = await prisma.classMember.findMany({
      where: { classId, role: "STUDENT" },
      select: { userId: true },
    });
    const studentIds = [...new Set(studentMembers.map((m) => m.userId))];

    if (studentIds.length === 0) {
      return NextResponse.json(
        { items: [], debug: { reason: "no students in class" } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Load set: cards (with term) & skills
    const setRaw = (await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        defaultSkillId: true,
        cards: {
          select: {
            id: true,
            term: true, // change if your model uses a different field
            inheritDefault: true,
            skills: {
              select: {
                skillId: true,
                skill: { select: { name: true } },
              },
            },
          },
        },
      },
    })) as SetRow | null;

    if (!setRaw) {
      return NextResponse.json(
        { items: [], debug: { reason: "set not found" } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const set: SetRow = setRaw;

    // Build mapping strictly from this set
    const cardToSkills = new Map<string, string[]>();
    const skillName = new Map<string, string>();

    if (set.defaultSkillId) {
      const sk = await prisma.skill.findUnique({
        where: { id: set.defaultSkillId },
        select: { name: true },
      });
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

    // Pull responses for ALL STUDENTS on THIS set's cards only
    const responses = await prisma.response.findMany({
      where: {
        userId: { in: studentIds },
        cardId: { in: cardIds },
      },
      orderBy: { createdAt: "asc" },
      select: { userId: true, cardId: true, createdAt: true, correct: true },
    });

    // per-user, per-card event sequences
    const perUserCard = new Map<string, Map<string, Ev[]>>();
    const seen = new Set<string>(); // `${userId}|${cardId}|${createdAtSec}`

    for (const r of responses) {
      if (!r.cardId) continue;
      const createdAt = new Date(r.createdAt as unknown as Date);
      const tSec = Math.floor(createdAt.getTime() / 1000);
      const key = `${r.userId}|${r.cardId}|${tSec}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const byUser = perUserCard.get(r.userId) ?? new Map<string, Ev[]>();
      const arr = byUser.get(r.cardId) ?? [];
      arr.push({ correct: r.correct, createdAt });
      byUser.set(r.cardId, arr);
      perUserCard.set(r.userId, byUser);
    }

    // BKT parameters per skill
    const paramRows = await prisma.bKTParams.findMany({
      where: { skillId: { in: presentSkillIds } },
      select: {
        skillId: true,
        pInit: true,
        pTransit: true,
        slip: true,
        guess: true,
        forget: true,
      },
    });
    const paramMap = new Map<string, BKTParams>(
      paramRows.map((p) => [
        p.skillId,
        {
          pInit: p.pInit,
          pTransit: p.pTransit,
          slip: p.slip,
          guess: p.guess,
          forget: p.forget,
        },
      ])
    );

    // 7-day correctness per card (aggregated)
    const since = new Date(Date.now() - 7 * DAY);
    const cw7Card = new Map<string, { c: number; w: number }>();
    for (const [, cardMap] of perUserCard) {
      for (const [cardId, seq] of cardMap) {
        for (const ev of seq) {
          if (ev.createdAt < since) continue;
          const agg = cw7Card.get(cardId) ?? { c: 0, w: 0 };
          if (ev.correct) agg.c++;
          else agg.w++;
          cw7Card.set(cardId, agg);
        }
      }
    }

    // Helper: run BKT sequence for a card using its primary skill (if any)
    function runBktForCard(cardId: string, seq: Ev[]) {
      const skillIdsForCard = cardToSkills.get(cardId) ?? [];
      const primarySkillId =
        skillIdsForCard[0] ?? set.defaultSkillId ?? null;

      const settings: BKTParams =
        (primarySkillId ? paramMap.get(primarySkillId) : undefined) ?? DEFAULT_BKT;

      const sorted = seq.slice().sort((a, b) => +a.createdAt - +b.createdAt);
      let p = settings.pInit;
      let lastAt: Date | null = null;

      for (const ev of sorted) {
        if (lastAt) {
          const gapDays = Math.max(0, Math.floor((+ev.createdAt - +lastAt) / DAY));
          if (gapDays > 0) {
            p = projectWithForgetting(p, gapDays, settings.forget ?? undefined);
          }
        }
        p = posteriorGivenObs(p, ev.correct, settings);
        lastAt = ev.createdAt;
      }
      p = clamp01(p);

      const anchor = lastAt ?? new Date();
      const { next } = nextReviewDateFrom(p, settings, 0.72, anchor);
      return { p, lastAt, next, primarySkillId };
    }

    // Aggregate average pKnow per card across students
    const cardAgg = new Map<
      string,
      {
        pSum: number;
        n: number;
        lastSeen: Date | null;
        nextMin: number | null;
        primarySkillId: string | null;
      }
    >();

    for (const userId of studentIds) {
      const cardMap = perUserCard.get(userId);
      if (!cardMap) continue;

      for (const [cardId, seq] of cardMap) {
        if (!seq.length) continue;

        const { p, lastAt, next, primarySkillId } = runBktForCard(cardId, seq);

        const cur =
          cardAgg.get(cardId) ?? {
            pSum: 0,
            n: 0,
            lastSeen: null as Date | null,
            nextMin: null as number | null,
            primarySkillId: primarySkillId ?? null,
          };

        cur.pSum += p;
        cur.n += 1;
        if (lastAt && (!cur.lastSeen || +lastAt > +cur.lastSeen)) {
          cur.lastSeen = lastAt;
        }
        const nextTime = next?.getTime?.() ?? NaN;
        if (Number.isFinite(nextTime)) {
          if (cur.nextMin == null || nextTime < cur.nextMin) {
            cur.nextMin = nextTime;
          }
        }
        if (!cur.primarySkillId && primarySkillId) {
          cur.primarySkillId = primarySkillId;
        }

        cardAgg.set(cardId, cur);
      }
    }

    const items = set.cards
      .map((c) => {
        const agg = cardAgg.get(c.id);
        if (!agg || agg.n === 0) {
          // No students have attempted this card yet → skip from "weak items"
          return null;
        }

        const avgP = clamp01(agg.pSum / agg.n);
        const skillIdForLabel =
          agg.primarySkillId ??
          (cardToSkills.get(c.id) ?? [])[0] ??
          set.defaultSkillId ??
          null;
        const labelSkillName = skillIdForLabel
          ? skillName.get(skillIdForLabel) ?? "Skill"
          : "Skill";

        const cw7 = cw7Card.get(c.id) ?? { c: 0, w: 0 };

        return {
          cardId: c.id,
          term: c.term,
          skillName: labelSkillName,
          pKnow: avgP,
          lastSeenAt: agg.lastSeen ? agg.lastSeen.toISOString() : null,
          nextReviewAt:
            agg.nextMin != null ? new Date(agg.nextMin).toISOString() : null,
          correct7: cw7.c,
          wrong7: cw7.w,
        };
      })
      .filter(Boolean) as {
      cardId: string;
      term: string;
      skillName: string;
      pKnow: number;
      lastSeenAt: string | null;
      nextReviewAt: string | null;
      correct7: number;
      wrong7: number;
    }[];

    return NextResponse.json(
      { items, debug: { classId, setId, studentCount: studentIds.length } },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(
      "GET /api/classes/[id]/sets/[setId]/item-stats error:",
      err
    );
    return NextResponse.json(
      { items: [], debug: { error: String(err) } },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
