-- CreateTable
CREATE TABLE "public"."StudyDay" (
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StudyDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "StudyDay_userId_day_idx" ON "public"."StudyDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "public"."StudyDay" ADD CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
