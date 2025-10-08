-- CreateEnum
CREATE TYPE "public"."ClassMemberRole" AS ENUM ('TEACHER', 'STUDENT');

-- CreateTable
CREATE TABLE "public"."Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassMember" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."ClassMemberRole" NOT NULL DEFAULT 'STUDENT',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassMember_pkey" PRIMARY KEY ("classId","userId")
);

-- CreateTable
CREATE TABLE "public"."ClassSet" (
    "classId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),

    CONSTRAINT "ClassSet_pkey" PRIMARY KEY ("classId","setId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "public"."Class"("joinCode");

-- CreateIndex
CREATE INDEX "Class_ownerId_createdAt_idx" ON "public"."Class"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassMember_userId_idx" ON "public"."ClassMember"("userId");

-- CreateIndex
CREATE INDEX "ClassSet_setId_idx" ON "public"."ClassSet"("setId");

-- AddForeignKey
ALTER TABLE "public"."Class" ADD CONSTRAINT "Class_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassMember" ADD CONSTRAINT "ClassMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassSet" ADD CONSTRAINT "ClassSet_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassSet" ADD CONSTRAINT "ClassSet_setId_fkey" FOREIGN KEY ("setId") REFERENCES "public"."StudySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassSet" ADD CONSTRAINT "ClassSet_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
