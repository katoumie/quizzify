-- CreateTable
CREATE TABLE "public"."StudyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "studied" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyActivity_userId_date_idx" ON "public"."StudyActivity"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudyActivity_userId_date_key" ON "public"."StudyActivity"("userId", "date");

-- AddForeignKey
ALTER TABLE "public"."StudyActivity" ADD CONSTRAINT "StudyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
