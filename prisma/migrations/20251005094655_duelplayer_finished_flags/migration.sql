-- AlterTable
ALTER TABLE "public"."DuelPlayer" ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "isFinished" BOOLEAN NOT NULL DEFAULT false;
