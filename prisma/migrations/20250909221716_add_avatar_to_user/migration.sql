-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatar" TEXT,
ALTER COLUMN "username" DROP NOT NULL;
