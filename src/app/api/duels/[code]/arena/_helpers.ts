// src/app/api/duels/[code]/arena/_helpers.ts
import { prisma } from "@/lib/prisma";
import { Prisma, DuelStatus, RoundState } from "@prisma/client";

export type ArenaPair = {
  aId: string;
  bId: string | null; // null means BYE
};

export type CreateRoundResult = {
  roundId: string;
  roundNo: number;
  questionCardId: string;
  // NOTE: We’ll wire DB-backed pairs later once we confirm your model name.
  pairs: Array<{ id: string; aId: string; bId: string | null; bye: boolean }>;
};

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function makePairs(playerIds: string[]): ArenaPair[] {
  const ids = [...playerIds];
  shuffleInPlace(ids);
  const pairs: ArenaPair[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    const a = ids[i];
    const b = ids[i + 1] ?? null;
    pairs.push({ aId: a, bId: b });
  }
  return pairs;
}

async function pickQuestionCardId(tx: Prisma.TransactionClient, sessionId: string): Promise<string> {
  const session = await tx.duelSession.findUnique({
    where: { id: sessionId },
    select: { setId: true },
  });
  if (!session?.setId) throw new Error("Session has no setId; cannot pick questions.");

  const cards = await tx.card.findMany({
    where: { setId: session.setId },
    select: { id: true },
  });
  if (cards.length === 0) throw new Error("This study set has no cards.");

  const idx = (Math.random() * cards.length) | 0;
  return cards[idx].id;
}

export async function createNextRoundTx(
  tx: Prisma.TransactionClient,
  sessionId: string
): Promise<CreateRoundResult> {
  const alive = await tx.duelPlayer.findMany({
    where: { sessionId, lives: { gt: 0 } },
    select: { id: true },
    // Your schema has connectedAt (used in your SSE route) instead of createdAt
    orderBy: { connectedAt: "asc" },
  });
  if (alive.length < 1) throw new Error("No alive players remain.");
  if (alive.length === 1) throw new Error("Only one player remains; no round needed.");

  const lastRound = await tx.duelRound.findFirst({
    where: { sessionId },
    orderBy: { roundNo: "desc" },
    select: { roundNo: true },
  });
  const roundNo = (lastRound?.roundNo ?? 0) + 1;

  // For later when we add DB-backed pair rows:
  // const pairs = makePairs(alive.map(p => p.id));
  const questionCardId = await pickQuestionCardId(tx, sessionId);
  const timerSec = Math.max(5, Math.min(15, 5 + Math.ceil(alive.length / 2)));

  const round = await tx.duelRound.create({
    data: {
      sessionId,
      roundNo,
      state: RoundState.PENDING, // was "PAIRING" – your enum uses PENDING
      timerSec,
      questionCardId,
    },
    select: { id: true },
  });

  // ⏳ We’ll create row(s) for pairs once we confirm your model name.
  // Returning an empty array keeps types happy while you rebuild step-by-step.
  const createdPairs: Array<{ id: string; aId: string; bId: string | null; bye: boolean }> = [];

  return {
    roundId: round.id,
    roundNo,
    questionCardId,
    pairs: createdPairs,
  };
}

export async function startArena(sessionId: string): Promise<CreateRoundResult> {
  return await prisma.$transaction(async (tx) => {
    const session = await tx.duelSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!session) throw new Error("Session not found.");

    if (session.status !== DuelStatus.RUNNING) {
      await tx.duelSession.update({
        where: { id: sessionId },
        data: { status: DuelStatus.RUNNING },
      });
    }

    const aliveCount = await tx.duelPlayer.count({
      where: { sessionId, lives: { gt: 0 } },
    });
    if (aliveCount < 2) {
      throw new Error("Need at least 2 alive players to start Arena.");
    }

    const next = await createNextRoundTx(tx, sessionId);
    return next;
  });
}
