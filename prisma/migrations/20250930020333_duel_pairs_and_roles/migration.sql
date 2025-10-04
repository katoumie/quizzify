/*
  Warnings:

  - You are about to drop the `DuelMatchup` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."DuelPlayerRole" AS ENUM ('PLAYER', 'SPECTATOR');

-- DropForeignKey
ALTER TABLE "public"."DuelMatchup" DROP CONSTRAINT "DuelMatchup_aId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DuelMatchup" DROP CONSTRAINT "DuelMatchup_bId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DuelMatchup" DROP CONSTRAINT "DuelMatchup_roundId_fkey";

-- AlterTable
ALTER TABLE "public"."DuelPlayer" ADD COLUMN     "role" "public"."DuelPlayerRole" NOT NULL DEFAULT 'PLAYER';

-- DropTable
DROP TABLE "public"."DuelMatchup";

-- CreateTable
CREATE TABLE "public"."DuelPair" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT,
    "bye" BOOLEAN NOT NULL DEFAULT false,
    "result" "public"."MatchResult",
    "winnerId" TEXT,

    CONSTRAINT "DuelPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuelPair_roundId_idx" ON "public"."DuelPair"("roundId");

-- CreateIndex
CREATE INDEX "DuelPair_aId_idx" ON "public"."DuelPair"("aId");

-- CreateIndex
CREATE INDEX "DuelPair_bId_idx" ON "public"."DuelPair"("bId");

-- CreateIndex
CREATE INDEX "DuelAnswer_roundId_playerId_idx" ON "public"."DuelAnswer"("roundId", "playerId");

-- CreateIndex
CREATE INDEX "DuelAnswer_createdAt_idx" ON "public"."DuelAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "DuelPlayer_sessionId_role_idx" ON "public"."DuelPlayer"("sessionId", "role");

-- CreateIndex
CREATE INDEX "DuelPlayer_userId_idx" ON "public"."DuelPlayer"("userId");

-- CreateIndex
CREATE INDEX "DuelRound_sessionId_state_idx" ON "public"."DuelRound"("sessionId", "state");

-- CreateIndex
CREATE INDEX "DuelSession_hostId_createdAt_idx" ON "public"."DuelSession"("hostId", "createdAt");

-- CreateIndex
CREATE INDEX "DuelSession_setId_createdAt_idx" ON "public"."DuelSession"("setId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."DuelPair" ADD CONSTRAINT "DuelPair_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."DuelRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelPair" ADD CONSTRAINT "DuelPair_aId_fkey" FOREIGN KEY ("aId") REFERENCES "public"."DuelPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelPair" ADD CONSTRAINT "DuelPair_bId_fkey" FOREIGN KEY ("bId") REFERENCES "public"."DuelPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
