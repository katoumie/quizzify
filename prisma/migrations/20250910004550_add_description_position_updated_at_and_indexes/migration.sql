/*
  Warnings:

  - Added the required column `updatedAt` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Folder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StudySet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Folder" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."StudySet" ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Card_setId_position_idx" ON "public"."Card"("setId", "position");

-- CreateIndex
CREATE INDEX "Folder_ownerId_createdAt_idx" ON "public"."Folder"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "StudySet_ownerId_createdAt_idx" ON "public"."StudySet"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "StudySet_folderId_createdAt_idx" ON "public"."StudySet"("folderId", "createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");
