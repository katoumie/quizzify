-- CreateTable
CREATE TABLE "public"."UserCardMastery" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "pKnow" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCardMastery_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateIndex
CREATE INDEX "UserCardMastery_userId_idx" ON "public"."UserCardMastery"("userId");

-- CreateIndex
CREATE INDEX "UserCardMastery_cardId_idx" ON "public"."UserCardMastery"("cardId");
