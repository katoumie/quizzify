// /src/lib/scheduler.ts
export type SkillMastery = {
  skillId: string;
  skillName: string;
  pKnow: number;              // 0..1
  lastReviewedAt: string;     // ISO timestamp in UTC or local; we'll trust it
  streak?: number;            // optional consecutive-correct count
};

export type SkillNextReview = {
  skillId: string;
  skillName: string;
  pKnow: number;
  nextReviewAt: string; // ISO
  intervalDays: number;
};

function intervalDaysFor(pKnow: number, streak = 0): number {
  let base =
    pKnow < 0.60 ? 1 :
    pKnow < 0.75 ? 2 :
    pKnow < 0.85 ? 4 :
    pKnow < 0.95 ? 7 : 14;

  // Slight bonus for streak at high mastery; cap to keep things humane.
  if (pKnow >= 0.95) {
    base += Math.min(streak, 8) * 2; // +2 days per step, max +16
  }
  return Math.min(base, 45);
}

export function computeNextReview(m: SkillMastery): SkillNextReview {
  const streak = m.streak ?? 0;
  const days = intervalDaysFor(m.pKnow, streak);

  const last = new Date(m.lastReviewedAt);
  if (Number.isNaN(last.getTime())) {
    // Fallback: if we can't parse lastReviewedAt, start from "now"
    const now = new Date();
    const next = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      skillId: m.skillId,
      skillName: m.skillName,
      pKnow: m.pKnow,
      nextReviewAt: next.toISOString(),
      intervalDays: days,
    };
  }

  const next = new Date(last.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    skillId: m.skillId,
    skillName: m.skillName,
    pKnow: m.pKnow,
    nextReviewAt: next.toISOString(),
    intervalDays: days,
  };
}

export function computeNextReviews(skills: SkillMastery[]): SkillNextReview[] {
  return skills.map(computeNextReview);
}
