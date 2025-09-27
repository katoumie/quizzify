// src\lib\duels.ts
export type PlayerLite = { id: string; lives: number; byeCount: number; lastOpp?: string };
export type Pair = [string, string];

export function pairArena(players: PlayerLite[], prevPairs: Record<string, Set<string>>) {
  const alive = [...players].sort((a, b) => b.lives - a.lives);
  const used = new Set<string>();
  const pairs: Pair[] = [];

  for (let i = 0; i < alive.length; i++) {
    const p = alive[i];
    if (used.has(p.id)) continue;

    let partnerIdx = -1;
    for (let j = i + 1; j < alive.length; j++) {
      const q = alive[j];
      if (used.has(q.id)) continue;
      const seen = prevPairs[p.id]?.has(q.id) || prevPairs[q.id]?.has(p.id);
      if (!seen) { partnerIdx = j; break; }
    }
    if (partnerIdx === -1) {
      for (let j = i + 1; j < alive.length; j++) {
        const q = alive[j];
        if (!used.has(q.id)) { partnerIdx = j; break; }
      }
    }
    if (partnerIdx !== -1) {
      const q = alive[partnerIdx];
      pairs.push([p.id, q.id]);
      used.add(p.id); used.add(q.id);
    }
  }

  const remaining = alive.filter(p => !used.has(p.id));
  let bye: string | undefined;
  if (remaining.length === 1) bye = remaining[0].id;
  else if (remaining.length > 1) bye = remaining.sort((a, b) => a.byeCount - b.byeCount)[0].id;

  return { pairs, bye };
}

export function arenaTimerSec(aliveCount: number) {
  if (aliveCount >= 17) return 15;
  if (aliveCount >= 9)  return 12;
  if (aliveCount >= 5)  return 10;
  if (aliveCount >= 3)  return 7;
  return 5;
}

export function ffaScore(responseMs: number, timerSec: number, correct: boolean): number {
  if (!correct) return 0;
  const T = timerSec * 1000;
  const raw = Math.max(0, Math.min(1, 1 - responseMs / T));
  return Math.round(100 * (0.4 + 0.6 * raw));
}

export function teamQuestionScore(
  teamResponses: {correct: boolean; responseMs: number}[],
  timerSec: number,
  maxTeamSize: number
): number {
  const per = teamResponses.map(r => ffaScore(r.responseMs, timerSec, r.correct));
  const sum = per.reduce((a, b) => a + b, 0);
  const scale = maxTeamSize / Math.max(1, teamResponses.length);
  return Math.round(sum * scale);
}
