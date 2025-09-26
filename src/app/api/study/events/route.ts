// /src/app/api/study/events/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BKT,
  clampBKT,
  posteriorGivenObs,
  projectWithForgetting,
} from "@/lib/bkt";

export const runtime = "nodejs";

type InEvent = { cardId: string; correct: boolean; timeMs?: number | null };

const DAY = 86400000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? "");
    const setId = String(body?.setId ?? "");
    const events: InEvent[] = Array.isArray(body?.events) ? body.events : [];

    if (!userId || !setId || events.length === 0) {
      return NextResponse.json({ error: "Missing userId/setId/events." }, { status: 400 });
    }

    // Load the set (for defaultSkillId fallback)
    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: { id: true, defaultSkillId: true },
    });
    if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });

    // Capture once for nested helpers
    const setDefaultSkillId: string | null = set.defaultSkillId ?? null;

    // Batch-load the distinct cards referenced
    const cardIds = [...new Set(events.map(e => e.cardId).filter(Boolean))];
    const cards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: {
        id: true,
        inheritDefault: true,
        skills: { select: { skillId: true } },
        set: { select: { defaultSkillId: true } },
      },
    });
    const cardMap = new Map(cards.map(c => [c.id, c]));

    // Caches
    const paramsBySkill = new Map<string, { pInit: number; pTransit: number; slip: number; guess: number; forget?: number | null }>();
    const skillMastery = new Map<string, { pKnow: number; updatedAt: Date | null }>();
    const cardMastery  = new Map<string, { pKnow: number; updatedAt: Date | null }>();

    function skillsForCard(cardId: string): string[] {
      const card = cardMap.get(cardId);
      if (!card) return [];
      if (card.skills.length > 0) return card.skills.map(s => s.skillId);
      const eff = card.inheritDefault ? (card.set?.defaultSkillId ?? setDefaultSkillId) : null;
      return eff ? [eff] : [];
    }

    async function getParams(skillId: string) {
      if (paramsBySkill.has(skillId)) return paramsBySkill.get(skillId)!;
      const row = await prisma.bKTParams.findUnique({ where: { skillId } }).catch(() => null);
      const p = clampBKT(row ? {
        pInit: row.pInit as number,
        pTransit: row.pTransit as number,
        slip: row.slip as number,
        guess: row.guess as number,
        forget: (row as any).forget ?? DEFAULT_BKT.forget ?? null,
      } : DEFAULT_BKT);
      paramsBySkill.set(skillId, p);
      return p;
    }

    async function getSkillMastery(skillId: string, now: Date) {
      if (skillMastery.has(skillId)) return skillMastery.get(skillId)!;
      const m = await prisma.userSkillMastery.findUnique({
        where: { userId_skillId: { userId, skillId } },
        select: { pKnow: true, updatedAt: true },
      });
      const params = await getParams(skillId);
      let p = m?.pKnow ?? params.pInit;
      const last = m?.updatedAt ?? null;
      if (params.forget && last) {
        const gapDays = Math.max(0, Math.floor((+now - +last) / DAY));
        if (gapDays > 0) p = projectWithForgetting(p, gapDays, params.forget);
      }
      const out = { pKnow: p, updatedAt: last };
      skillMastery.set(skillId, out);
      return out;
    }

    async function getCardMastery(cardId: string, now: Date, paramsForCard: { forget?: number | null; pInit: number }) {
      if (cardMastery.has(cardId)) return cardMastery.get(cardId)!;
      const m = await prisma.userCardMastery.findUnique({
        where: { userId_cardId: { userId, cardId } },
        select: { pKnow: true, updatedAt: true },
      });
      let p = m?.pKnow ?? paramsForCard.pInit;
      const last = m?.updatedAt ?? null;
      if (paramsForCard.forget && last) {
        const gapDays = Math.max(0, Math.floor((+now - +last) / DAY));
        if (gapDays > 0) p = projectWithForgetting(p, gapDays, paramsForCard.forget);
      }
      const out = { pKnow: p, updatedAt: last };
      cardMastery.set(cardId, out);
      return out;
    }

    const responseCreates: Parameters<typeof prisma.response.create>[0]["data"][] = [];
    const now = new Date();

    // Process events
    for (const ev of events) {
      const sids = skillsForCard(ev.cardId);
      if (sids.length === 0) continue;

      // Use the first skill as the card's parameter source (fallback to DEFAULT_BKT)
      const primarySkillId = sids[0];
      const params = await getParams(primarySkillId);

      // Update item-level (card) mastery
      {
        const cm = await getCardMastery(ev.cardId, now, { pInit: params.pInit, forget: params.forget });
        const nextPc = posteriorGivenObs(cm.pKnow, Boolean(ev.correct), params);
        cardMastery.set(ev.cardId, { pKnow: nextPc, updatedAt: now });
      }

      // Update skill-level mastery for all mapped skills
      for (const skillId of sids) {
        const sm = await getSkillMastery(skillId, now);
        const sp = await getParams(skillId);
        const nextPs = posteriorGivenObs(sm.pKnow, Boolean(ev.correct), sp);
        skillMastery.set(skillId, { pKnow: nextPs, updatedAt: now });
      }

      // Log response
      responseCreates.push({
        userId,
        cardId: ev.cardId,
        skillId: primarySkillId,
        correct: Boolean(ev.correct),
        timeMs: Number.isFinite(ev.timeMs) ? Math.max(0, Math.floor(ev.timeMs!)) : null,
      });
    }

    // Build transaction
    const tx: any[] = [];
    for (const r of responseCreates) tx.push(prisma.response.create({ data: r }));

    for (const [skillId, sm] of skillMastery.entries()) {
      tx.push(
        prisma.userSkillMastery.upsert({
          where: { userId_skillId: { userId, skillId } },
          update: { pKnow: sm.pKnow },
          create: { userId, skillId, pKnow: sm.pKnow },
        })
      );
      tx.push(
        prisma.userSkill.upsert({
          where: { userId_skillId: { userId, skillId } },
          update: {},
          create: { userId, skillId },
        })
      );
    }

    for (const [cardId, cm] of cardMastery.entries()) {
      tx.push(
        prisma.userCardMastery.upsert({
          where: { userId_cardId: { userId, cardId } },
          update: { pKnow: cm.pKnow },
          create: { userId, cardId, pKnow: cm.pKnow },
        })
      );
    }

    if (tx.length) await prisma.$transaction(tx);

    return NextResponse.json(
      { ok: true, responsesLogged: responseCreates.length, skillsUpdated: skillMastery.size, cardsUpdated: cardMastery.size },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/study/events error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
