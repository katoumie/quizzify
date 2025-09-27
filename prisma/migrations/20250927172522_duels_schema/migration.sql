-- CreateEnum
CREATE TYPE "public"."DuelMode" AS ENUM ('ARENA', 'TEAM', 'STANDARD');

-- CreateEnum
CREATE TYPE "public"."DuelStatus" AS ENUM ('LOBBY', 'RUNNING', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RoundState" AS ENUM ('PENDING', 'LIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."MatchResult" AS ENUM ('A_WIN', 'B_WIN', 'BOTH_LOSE', 'BYE');

-- CreateTable
CREATE TABLE "public"."DuelSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "mode" "public"."DuelMode" NOT NULL,
    "status" "public"."DuelStatus" NOT NULL DEFAULT 'LOBBY',
    "options" JSONB NOT NULL DEFAULT '{}',
    "initialPlayerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "DuelSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DuelPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "team" TEXT,
    "lives" INTEGER NOT NULL DEFAULT 3,
    "score" INTEGER NOT NULL DEFAULT 0,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "eliminatedAt" TIMESTAMP(3),
    "byeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DuelPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DuelRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "questionCardId" TEXT NOT NULL,
    "timerSec" INTEGER NOT NULL,
    "state" "public"."RoundState" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "DuelRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DuelMatchup" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "result" "public"."MatchResult",

    CONSTRAINT "DuelMatchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DuelAnswer" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "choiceIndex" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuelAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuelSession_code_key" ON "public"."DuelSession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DuelRound_sessionId_roundNo_key" ON "public"."DuelRound"("sessionId", "roundNo");

-- AddForeignKey
ALTER TABLE "public"."DuelSession" ADD CONSTRAINT "DuelSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelSession" ADD CONSTRAINT "DuelSession_setId_fkey" FOREIGN KEY ("setId") REFERENCES "public"."StudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelPlayer" ADD CONSTRAINT "DuelPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."DuelSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelPlayer" ADD CONSTRAINT "DuelPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelRound" ADD CONSTRAINT "DuelRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."DuelSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelMatchup" ADD CONSTRAINT "DuelMatchup_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."DuelRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelMatchup" ADD CONSTRAINT "DuelMatchup_aId_fkey" FOREIGN KEY ("aId") REFERENCES "public"."DuelPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelMatchup" ADD CONSTRAINT "DuelMatchup_bId_fkey" FOREIGN KEY ("bId") REFERENCES "public"."DuelPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelAnswer" ADD CONSTRAINT "DuelAnswer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."DuelRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DuelAnswer" ADD CONSTRAINT "DuelAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."DuelPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
