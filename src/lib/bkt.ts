// /src/lib/bkt.ts
export type BKTParams = {
  pInit: number;     // P(L0)
  pTransit: number;  // T (learn)
  slip: number;      // S
  guess: number;     // G
  forget?: number | null; // per-day decay, 0..1 (small)
};

export const DEFAULT_BKT: BKTParams = {
  pInit:   0.20,
  pTransit:0.04,
  slip:    0.10,
  guess:   0.30,
  forget:  0.015, // ≈1.5% per day
};

export function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

/** Keep parameters in a reasonable, identifiable region. */
export function clampBKT(p: BKTParams): BKTParams {
  let { pInit, pTransit, slip, guess, forget } = p;
  pInit    = Math.min(0.50, Math.max(0.00, pInit));
  pTransit = Math.min(0.20, Math.max(0.00, pTransit));
  slip     = Math.min(0.30, Math.max(0.00, slip));
  guess    = Math.min(0.40, Math.max(0.00, guess));
  if (guess >= 1 - slip) guess = Math.max(0, 1 - slip - 0.05);
  if (forget != null) forget = Math.min(0.05, Math.max(0.0, forget));
  return { pInit, pTransit, slip, guess, forget: forget ?? null };
}

/** Single-step posterior after observing correctness, then apply learning transition. */
export function posteriorGivenObs(pKnowPrev: number, correct: boolean, p: BKTParams): number {
  const L = clamp01(pKnowPrev);
  const S = clamp01(p.slip);
  const G = clamp01(p.guess);

  // Evidence step (Bayes)
  const num = correct ? L * (1 - S) : L * S;
  const den = correct ? (L * (1 - S) + (1 - L) * G) : (L * S + (1 - L) * (1 - G));
  const post = den > 1e-12 ? num / den : L;

  // Learning transition
  const afterLearn = post + (1 - post) * p.pTransit;
  return clamp01(afterLearn);
}

/** Project forgetting forward by whole days (if forget provided). */
export function projectWithForgetting(pKnow: number, days: number, forget?: number | null) {
  if (!forget || forget <= 0) return clamp01(pKnow);
  const f = Math.min(0.2, Math.max(1e-6, forget)); // numeric safety
  const retention = Math.pow(1 - f, Math.max(0, Math.floor(days)));
  return clamp01(pKnow * retention);
}

/** Compute next review date aiming to keep at/above threshold. */
export function nextReviewDateFrom(
  pKnow: number,
  p: BKTParams,
  threshold = 0.95,
  now = new Date()
) {
  const P = clamp01(pKnow);

  // If no forgetting, fall back to a simple, literature-style ladder.
  if (!p.forget || p.forget <= 0) {
    const d =
      P < 0.60 ? 0 :
      P < 0.75 ? 1 :
      P < 0.85 ? 3 :
      P < 0.95 ? 7 : 14;
    const at = new Date(now.getTime() + d * 86400000);
    return { next: at, days: d };
  }

  // Solve P * (1 - f)^d = threshold → d = ln(thr/P) / ln(1 - f)
  const f = Math.min(0.2, Math.max(1e-6, p.forget)); // numeric safety
  if (P <= 0) return { next: now, days: 0 };
  if (P <= threshold) return { next: now, days: 0 };

  const d = Math.log(threshold / P) / Math.log(1 - f);
  const days = Math.max(0, Math.floor(d));
  const at = new Date(now.getTime() + days * 86400000);
  return { next: at, days };
}
