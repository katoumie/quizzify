-- CreateTable
CREATE TABLE "public"."UserBadge" (
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "showcased" BOOLEAN NOT NULL DEFAULT false,
    "showcaseOrder" INTEGER,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeKey")
);

-- CreateIndex
CREATE INDEX "UserBadge_userId_showcased_showcaseOrder_idx" ON "public"."UserBadge"("userId", "showcased", "showcaseOrder");

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
