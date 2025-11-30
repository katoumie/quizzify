// /src/app/api/classes/[id]/sets/[setId]/stats/route.ts
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
  req: Request,
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
        {
          skills: [],
          totals: {
            skills: 0,
            mastered: 0,
            nextDueAt: null,
            avgMasteryPct: 0,
            studentCount: 0,
          },
          debug: { reason: "missing classId/setId" },
        },
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
        {
          skills: [],
          totals: {
            skills: 0,
            mastered: 0,
            nextDueAt: null,
            avgMasteryPct: 0,
            studentCount: 0,
          },
          debug: { reason: "no students in class" },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Load set: cards & skills (mapping is ONLY from this set)
    const setRaw = (await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        defaultSkillId: true,
        cards: {
          select: {
            id: true,
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
        {
          skills: [],
          totals: {
            skills: 0,
            mastered: 0,
            nextDueAt: null,
            avgMasteryPct: 0,
            studentCount: studentIds.length,
          },
          debug: { reason: "set not found" },
        },
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
    if (presentSkillIds.length === 0) {
      return NextResponse.json(
        {
          skills: [],
          totals: {
            skills: 0,
            mastered: 0,
            nextDueAt: null,
            avgMasteryPct: 0,
            studentCount: studentIds.length,
          },
          debug: { reason: "no skills mapped in this set" },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

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

    // per-user, per-skill event sequences
    const perUserSkill = new Map<string, Map<string, Ev[]>>();
    const seen = new Set<string>(); // `${userId}|${sid}|${cardId}|${createdAtSec}`

    for (const r of responses) {
      const createdAt = new Date(r.createdAt as unknown as Date);
      const tSec = Math.floor(createdAt.getTime() / 1000);
      const mappedSids = r.cardId ? (cardToSkills.get(r.cardId) ?? []) : [];

      for (const sid of mappedSids) {
        const key = `${r.userId}|${sid}|${r.cardId ?? "?"}|${tSec}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const byUser = perUserSkill.get(r.userId) ?? new Map<string, Ev[]>();
        const arr = byUser.get(sid) ?? [];
        arr.push({ correct: r.correct, createdAt });
        byUser.set(sid, arr);
        perUserSkill.set(r.userId, byUser);
      }
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

    // 7-day correctness (aggregated across students)
    const since = new Date(Date.now() - 7 * DAY);
    const cw7 = new Map<string, { c: number; w: number }>();
    for (const [, skillMap] of perUserSkill) {
      for (const [sid, seq] of skillMap) {
        for (const ev of seq) {
          if (ev.createdAt < since) continue;
          const agg = cw7.get(sid) ?? { c: 0, w: 0 };
          if (ev.correct) agg.c++;
          else agg.w++;
          cw7.set(sid, agg);
        }
      }
    }

    // Helper: run BKT for one skill sequence
    function runBktForSeq(seq: Ev[], settings: BKTParams) {
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
      return { p, lastAt, next };
    }

    // Compute per-student mastery & aggregate pKnow
    const skillPsum = new Map<string, number>();
    const skillNextEarliest = new Map<string, number | null>();
    let globalNextEarliest = Number.POSITIVE_INFINITY;
    let masteryPctSum = 0;

    for (const sid of presentSkillIds) {
      skillPsum.set(sid, 0);
      skillNextEarliest.set(sid, null);
    }

    for (const userId of studentIds) {
      const skillMap = perUserSkill.get(userId) ?? new Map<string, Ev[]>();
      let masteredForStudent = 0;

      for (const sid of presentSkillIds) {
        const seq = skillMap.get(sid) ?? [];
        const settings: BKTParams = paramMap.get(sid) ?? DEFAULT_BKT;

        const { p, next } = runBktForSeq(seq, settings);

        const prev = skillPsum.get(sid) ?? 0;
        skillPsum.set(sid, prev + p);

        if (p >= 0.95) masteredForStudent++;

        const nextTime = next?.getTime?.() ?? NaN;
        if (Number.isFinite(nextTime)) {
          const curSkillMin = skillNextEarliest.get(sid);
          if (curSkillMin == null || nextTime < curSkillMin) {
            skillNextEarliest.set(sid, nextTime);
          }
          if (nextTime < globalNextEarliest) {
            globalNextEarliest = nextTime;
          }
        }
      }

      const skillsCount = presentSkillIds.length;
      if (skillsCount > 0) {
        masteryPctSum += masteredForStudent / skillsCount;
      }
    }

    const totalStudents = studentIds.length;
    const skillRows = presentSkillIds.map((sid) => {
      const sumP = skillPsum.get(sid) ?? 0;
      const avgP = totalStudents > 0 ? clamp01(sumP / totalStudents) : 0;
      const nextMs = skillNextEarliest.get(sid);
      return {
        skillId: sid,
        skillName: skillName.get(sid) ?? "Skill",
        pKnow: avgP,
        masteryAchieved: avgP >= 0.95,
        nextReviewAt: nextMs != null ? new Date(nextMs).toISOString() : null,
        correct7: cw7.get(sid)?.c ?? 0,
        wrong7: cw7.get(sid)?.w ?? 0,
      };
    });

    const totals = {
      skills: skillRows.length,
      mastered: skillRows.filter((s) => s.masteryAchieved).length,
      nextDueAt:
        skillRows.length && Number.isFinite(globalNextEarliest)
          ? new Date(globalNextEarliest).toISOString()
          : null,
      avgMasteryPct: totalStudents > 0 ? clamp01(masteryPctSum / totalStudents) : 0,
      studentCount: totalStudents,
    };

    return NextResponse.json(
      {
        skills: skillRows,
        totals,
        debug: {
          now: new Date().toISOString(),
          classId,
          setId,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(
      "GET /api/classes/[id]/sets/[setId]/stats error:",
      err
    );
    return NextResponse.json(
      {
        skills: [],
        totals: {
          skills: 0,
          mastered: 0,
          nextDueAt: null,
          avgMasteryPct: 0,
          studentCount: 0,
        },
        debug: { error: String(err) },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}