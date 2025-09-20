/*
  Warnings:

  - A unique constraint covering the columns `[nameNorm]` on the table `Skill` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Skill_nameNorm_key" ON "public"."Skill"("nameNorm");
