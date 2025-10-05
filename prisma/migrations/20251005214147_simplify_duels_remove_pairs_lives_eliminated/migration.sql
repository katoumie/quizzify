/*
  Warnings:

  - You are about to drop the column `byeCount` on the `DuelPlayer` table. All the data in the column will be lost.
  - You are about to drop the column `eliminatedAt` on the `DuelPlayer` table. All the data in the column will be lost.
  - You are about to drop the column `lives` on the `DuelPlayer` table. All the data in the column will be lost.
  - You are about to drop the column `team` on the `DuelPlayer` table. All the data in the column will be lost.
  - You are about to drop the `DuelPair` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."DuelPair" DROP CONSTRAINT "DuelPair_aId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DuelPair" DROP CONSTRAINT "DuelPair_bId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DuelPair" DROP CONSTRAINT "DuelPair_roundId_fkey";

-- AlterTable
ALTER TABLE "public"."DuelPlayer" DROP COLUMN "byeCount",
DROP COLUMN "eliminatedAt",
DROP COLUMN "lives",
DROP COLUMN "team";

-- DropTable
DROP TABLE "public"."DuelPair";

-- DropEnum
DROP TYPE "public"."MatchResult";
