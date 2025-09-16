/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Folder` table. All the data in the column will be lost.
  - You are about to drop the column `copiedFromId` on the `StudySet` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `StudySet` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `StudySet` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `StudySet` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `StudySet` table. All the data in the column will be lost.
  - You are about to drop the column `visibility` on the `StudySet` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Like` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Like" DROP CONSTRAINT "Like_setId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Like" DROP CONSTRAINT "Like_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudySet" DROP CONSTRAINT "StudySet_copiedFromId_fkey";

-- DropIndex
DROP INDEX "public"."Card_setId_idx";

-- DropIndex
DROP INDEX "public"."Folder_ownerId_idx";

-- DropIndex
DROP INDEX "public"."StudySet_folderId_idx";

-- DropIndex
DROP INDEX "public"."StudySet_ownerId_idx";

-- DropIndex
DROP INDEX "public"."StudySet_visibility_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."Card" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "public"."Folder" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "public"."StudySet" DROP COLUMN "copiedFromId",
DROP COLUMN "description",
DROP COLUMN "language",
DROP COLUMN "subject",
DROP COLUMN "updatedAt",
DROP COLUMN "visibility",
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "public"."Like";

-- DropEnum
DROP TYPE "public"."Visibility";
