// /src/app/api/sets/[id]/due/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Target recall threshold for scheduling (used when BKTParams.forget is present)
const TARGET_RECALL = 0.72;

// Fallback ladder (days) when forget is not configured for a skill
function ladderDays(pKnow: number): number {
  if (pKnow >= 0.95) return 14;
  if (pKnow >= 0.85) return 7;
  if (pKnow >= 0.70) return 4;
  if (pKnow >= 0.55) return 2;
  return 1;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const setId = ctx?.params?.id;
    const url = new URL(req.url);
    const ownerId = url.searchParams.get("ownerId") || undefined;
    if (!setId || !ownerId) {
      return NextResponse.json({ error: "Missing set id or ownerId." }, { status: 400 });
    }

    // Pull the set with cards, default skill, and per-card skills
    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        id: true,
        defaultSkillId: true,
        cards: {
          select: {
            id: true,
            inheritDefault: true,
            createdAt: true,
            skills: { select: { skillId: true } },
          },
        },
      },
    });
    if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const cardIds = set.cards.map((c) => c.id);

    // Build effective skill per card (explicit card skill if exists; else defaultSkill if inheritDefault)
    const cardSkillId: Record<string, string | null> = {};
    const skillSet = new Set<string>();

    for (const c of set.cards) {
      const explicit = c.skills?.[0]?.skillId || null; // MVP: first skill only
      const eff =
        explicit ||
        (set.defaultSkillId && c.inheritDefault ? set.defaultSkillId : null);
      cardSkillId[c.id] = eff;
      if (eff) skillSet.add(eff);
    }
    const skillIds = Array.from(skillSet);

    // Pull mastery and params for those skills
    const [masteries, params] = await Promise.all([
      prisma.userSkillMastery.findMany({
        where: { userId: ownerId, skillId: { in: skillIds } },
        select: { skillId: true, pKnow: true, updatedAt: true },
      }),
      prisma.bKTParams.findMany({
        where: { skillId: { in: skillIds } },
        select: { skillId: true, forget: true },
      }),
    ]);

    const masteryMap = new Map(masteries.map((m) => [m.skillId, m]));
    const paramMap = new Map(params.map((p) => [p.skillId, p]));

    // Last-seen per skill inside THIS set (max Response.createdAt on any card in the set for that skill)
    const lastResponses = await prisma.response.groupBy({
      by: ["skillId"],
      where: { userId: ownerId, cardId: { in: cardIds }, skillId: { in: skillIds } },
      _max: { createdAt: true },
    });
    const lastSeenMap = new Map(
      lastResponses.map((r) => [r.skillId, r._max.createdAt as Date | null])
    );

    // Enrich skills with dueAt
    const now = new Date();

    type SkillDue = {
      skillId: string;
      name: string;
      pKnow: number;
      lastSeenISO: string;
      dueAtISO: string;
      dueInMs: number;
    };

    const skills = await prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, name: true },
    });

    const duePerSkill: SkillDue[] = skills.map((sk) => {
      const pKnow = masteryMap.get(sk.id)?.pKnow ?? 0.3; // default if unknown
      const lastSeen = lastSeenMap.get(sk.id) ?? now;
      const forget = paramMap.get(sk.id)?.forget ?? null;

      let dueAt = lastSeen;
      if (forget && forget > 0) {
        // Solve pKnow * exp(-forget * Δdays) = TARGET_RECALL
        // If pKnow <= TARGET, it's due now
        if (pKnow > TARGET_RECALL) {
          const deltaDays = Math.log(TARGET_RECALL / pKnow) / (-forget);
          dueAt = new Date(lastSeen.getTime() + deltaDays * 24 * 60 * 60 * 1000);
        } else {
          dueAt = lastSeen; // already below threshold -> due now
        }
      } else {
        const spanDays = ladderDays(pKnow);
        dueAt = new Date(lastSeen.getTime() + spanDays * 24 * 60 * 60 * 1000);
      }

      return {
        skillId: sk.id,
        name: sk.name,
        pKnow,
        lastSeenISO: lastSeen.toISOString(),
        dueAtISO: dueAt.toISOString(),
        dueInMs: +dueAt - +now,
      };
    });

    // A card is "recommended" if its effective skill is due now
    const dueSkillIdSet = new Set(
      duePerSkill.filter((d) => d.dueInMs <= 0).map((d) => d.skillId)
    );

    const recommendedCardIds = set.cards
      .filter((c) => {
        const eff = cardSkillId[c.id];
        // If card has no skill link at all, we do NOT recommend it here (only via "all items")
        return eff ? dueSkillIdSet.has(eff) : false;
      })
      .map((c) => c.id);

    return NextResponse.json(
      {
        skills: duePerSkill.sort((a, b) => a.dueInMs - b.dueInMs),
        recommendedCardIds,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/sets/[id]/due error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
