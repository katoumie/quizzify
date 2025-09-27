import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

type RoundLike = {
  id: string;
  sessionId: string;
  roundNo: number;
  state: "PENDING" | "LIVE" | "RESOLVED";
  questionCardId: string;
  timerSec: number;
  startedAt: Date | null;
  endedAt: Date | null;
};

function hash32(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return (a & 0xfffffff) / 0x10000000;
  };
}
function seededShuffle<T>(arr: T[], seedStr: string) {
  const r = rng(hash32(seedStr));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build prompt/choices deterministically based on round.id and set cards
export async function buildQuestionPayload(round: RoundLike, setId: string) {
  const [target, all] = await Promise.all([
    prisma.card.findUnique({ where: { id: round.questionCardId }, select: { id: true, term: true, definition: true } }),
    prisma.card.findMany({ where: { setId }, select: { id: true, definition: true }, orderBy: { id: "asc" } }),
  ]);
  if (!target) return { prompt: "Question unavailable", choices: [] as string[], correctIndex: 0 };

  // Pick 3 distractors deterministically from the sorted list
  const idx = all.findIndex((c) => c.id === target.id);
  const distractors: string[] = [];
  for (let step = 1; distractors.length < 3 && step < all.length; step++) {
    const j = (idx + step) % all.length;
    if (all[j].id !== target.id && !distractors.includes(all[j].definition)) {
      distractors.push(all[j].definition);
    }
  }
  while (distractors.length < 3) distractors.push(target.definition); // edge case small sets

  const base = [target.definition, ...distractors.slice(0, 3)];
  const shuffled = seededShuffle(base, round.id);
  const correctIndex = shuffled.findIndex((x) => x === target.definition);

  return {
    prompt: target.term,   // term → pick definition (4-choice)
    choices: shuffled,
    correctIndex,
  };
}

export async function arenaSnapshot(code: string) {
  const sess = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true, code: true, hostId: true, mode: true, status: true, setId: true,
      players: { select: { id: true, userId: true, displayName: true } },
      rounds: {
        select: { id: true, roundNo: true, state: true, questionCardId: true, timerSec: true, startedAt: true, endedAt: true },
        orderBy: { roundNo: "desc" },
        take: 1,
      },
    },
  });
  if (!sess) return null;

  const round = sess.rounds[0];
  let question: { prompt?: string; choices?: string[]; correctIndex?: number } | undefined;
  if (round) {
    const q = await buildQuestionPayload(round as any, sess.setId);
    question = { prompt: q.prompt, choices: q.choices };
    if (round.state === "RESOLVED") question.correctIndex = q.correctIndex;
  }

  const answeredCount = round
    ? await prisma.duelAnswer.count({ where: { roundId: round.id } })
    : 0;

  return {
    session: {
      id: sess.id,
      code: sess.code,
      hostId: sess.hostId,
      mode: sess.mode as any,
      status: sess.status as any,
      players: sess.players,
    },
    round: round
      ? {
          id: round.id,
          roundNo: round.roundNo,
          state: round.state as any,
          timerSec: round.timerSec,
          startedAt: round.startedAt?.toISOString() ?? null,
          endedAt: round.endedAt?.toISOString() ?? null,
          prompt: question?.prompt,
          choices: question?.choices,
          correctIndex: question?.correctIndex,
        }
      : null,
    answeredCount,
    totalPlayers: sess.players.length,
  };
}

export async function broadcastRoundStart(sessionId: string, round: RoundLike, setId: string) {
  const q = await buildQuestionPayload(round, setId);
  const payload = {
    type: "round-start",
    round: {
      id: round.id,
      roundNo: round.roundNo,
      timerSec: round.timerSec,
      startedAt: (round.startedAt ?? new Date()).toISOString(),
    },
    question: { prompt: q.prompt, choices: q.choices },
    answeredCount: 0,
    totalPlayers: await prisma.duelPlayer.count({ where: { sessionId } }),
  };

  duelsBus.publish(sessionId, payload);
  const sess = await prisma.duelSession.findUnique({ where: { id: sessionId }, select: { code: true } });
  if (sess) duelsBus.publish(sess.code, payload);
}

export async function broadcastRoundResolve(sessionId: string, round: RoundLike, setId: string) {
  const q = await buildQuestionPayload(round, setId);
  const payload = {
    type: "round-resolve",
    roundId: round.id,
    correctIndex: q.correctIndex,
    endedAt: (round.endedAt ?? new Date()).toISOString(),
  };

  duelsBus.publish(sessionId, payload);
  const sess = await prisma.duelSession.findUnique({ where: { id: sessionId }, select: { code: true } });
  if (sess) duelsBus.publish(sess.code, payload);
}
