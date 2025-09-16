-- CreateTable
CREATE TABLE "public"."Like" (
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("userId","setId")
);

-- CreateIndex
CREATE INDEX "Like_setId_idx" ON "public"."Like"("setId");

-- AddForeignKey
ALTER TABLE "public"."Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Like" ADD CONSTRAINT "Like_setId_fkey" FOREIGN KEY ("setId") REFERENCES "public"."StudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
