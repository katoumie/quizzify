-- CreateEnum
CREATE TYPE "public"."MagicNoteStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'GENERATING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."MagicNoteSourceType" AS ENUM ('PDF', 'DOCX', 'PPTX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."MagicNoteJobStage" AS ENUM ('EXTRACT', 'SUMMARIZE', 'REFINE');

-- CreateEnum
CREATE TYPE "public"."MagicNoteJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'ERROR');

-- CreateTable
CREATE TABLE "public"."MagicNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."MagicNoteStatus" NOT NULL DEFAULT 'UPLOADED',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sourceKey" TEXT,
    "sourceName" TEXT,
    "sourceMime" TEXT,
    "sourceSize" INTEGER,
    "wordCount" INTEGER,
    "sectionCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MagicNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MagicNoteSection" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT,
    "contentMd" TEXT NOT NULL,
    "tokenEst" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MagicNoteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MagicNoteSource" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "type" "public"."MagicNoteSourceType" NOT NULL DEFAULT 'UNKNOWN',
    "storageKey" TEXT NOT NULL,
    "mime" TEXT,
    "pageCount" INTEGER,
    "slideCount" INTEGER,
    "bytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicNoteSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MagicNoteJob" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "stage" "public"."MagicNoteJobStage" NOT NULL,
    "status" "public"."MagicNoteJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicNoteJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MagicNote_ownerId_createdAt_idx" ON "public"."MagicNote"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "MagicNote_status_updatedAt_idx" ON "public"."MagicNote"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "MagicNoteSection_noteId_position_idx" ON "public"."MagicNoteSection"("noteId", "position");

-- CreateIndex
CREATE INDEX "MagicNoteSource_noteId_type_idx" ON "public"."MagicNoteSource"("noteId", "type");

-- CreateIndex
CREATE INDEX "MagicNoteJob_noteId_stage_status_idx" ON "public"."MagicNoteJob"("noteId", "stage", "status");

-- AddForeignKey
ALTER TABLE "public"."MagicNote" ADD CONSTRAINT "MagicNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MagicNoteSection" ADD CONSTRAINT "MagicNoteSection_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."MagicNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MagicNoteSource" ADD CONSTRAINT "MagicNoteSource_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."MagicNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MagicNoteJob" ADD CONSTRAINT "MagicNoteJob_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."MagicNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
