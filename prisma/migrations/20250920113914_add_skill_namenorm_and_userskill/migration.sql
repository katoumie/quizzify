-- AlterTable
ALTER TABLE "public"."StudySet" ADD COLUMN     "defaultSkillId" TEXT;

-- CreateTable
CREATE TABLE "public"."Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNorm" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSkill" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "public"."SkillAlias" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "SkillAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CardSkill" (
    "cardId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "CardSkill_pkey" PRIMARY KEY ("cardId","skillId")
);

-- CreateTable
CREATE TABLE "public"."BKTParams" (
    "skillId" TEXT NOT NULL,
    "pInit" DOUBLE PRECISION NOT NULL,
    "pTransit" DOUBLE PRECISION NOT NULL,
    "slip" DOUBLE PRECISION NOT NULL,
    "guess" DOUBLE PRECISION NOT NULL,
    "forget" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BKTParams_pkey" PRIMARY KEY ("skillId")
);

-- CreateTable
CREATE TABLE "public"."UserSkillMastery" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "pKnow" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillMastery_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "public"."Response" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "confidence" INTEGER,
    "timeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSkill_skillId_idx" ON "public"."UserSkill"("skillId");

-- CreateIndex
CREATE INDEX "SkillAlias_label_idx" ON "public"."SkillAlias"("label");

-- CreateIndex
CREATE UNIQUE INDEX "SkillAlias_skillId_label_key" ON "public"."SkillAlias"("skillId", "label");

-- CreateIndex
CREATE INDEX "CardSkill_skillId_idx" ON "public"."CardSkill"("skillId");

-- CreateIndex
CREATE INDEX "UserSkillMastery_skillId_idx" ON "public"."UserSkillMastery"("skillId");

-- CreateIndex
CREATE INDEX "Response_userId_createdAt_idx" ON "public"."Response"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Response_skillId_createdAt_idx" ON "public"."Response"("skillId", "createdAt");

-- CreateIndex
CREATE INDEX "Response_cardId_createdAt_idx" ON "public"."Response"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "StudySet_defaultSkillId_idx" ON "public"."StudySet"("defaultSkillId");

-- AddForeignKey
ALTER TABLE "public"."StudySet" ADD CONSTRAINT "StudySet_defaultSkillId_fkey" FOREIGN KEY ("defaultSkillId") REFERENCES "public"."Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Skill" ADD CONSTRAINT "Skill_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SkillAlias" ADD CONSTRAINT "SkillAlias_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CardSkill" ADD CONSTRAINT "CardSkill_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CardSkill" ADD CONSTRAINT "CardSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BKTParams" ADD CONSTRAINT "BKTParams_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSkillMastery" ADD CONSTRAINT "UserSkillMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSkillMastery" ADD CONSTRAINT "UserSkillMastery_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Response" ADD CONSTRAINT "Response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Response" ADD CONSTRAINT "Response_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Response" ADD CONSTRAINT "Response_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
