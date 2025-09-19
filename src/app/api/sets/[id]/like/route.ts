// /src/app/api/sets/[id]/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Requirements:
 * - Prisma schema should include:
 *   model Like {
 *     id        String   @id @default(cuid())
 *     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
 *     userId    String
 *     set       StudySet @relation(fields: [setId], references: [id], onDelete: Cascade)
 *     setId     String
 *     createdAt DateTime @default(now())
 *     @@unique([userId, setId])
 *   }
 */

/** GET like status + count (requires ?userId=...) */
export async function GET(
  req: NextRequest,
  context: RouteContext<"/api/sets/[id]/like">
) {
  try {
    const { id: setId } = await context.params;
    if (!setId) return NextResponse.json({ error: "Missing set id." }, { status: 400 });

    const url = new URL(req.url);
    const userId = String(url.searchParams.get("userId") || "");
    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

    // fast checks
    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: { id: true, isPublic: true, ownerId: true },
    });
    if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });

    const existing = await prisma.like.findFirst({ where: { userId, setId } });
    const likeCount = await prisma.like.count({ where: { setId } });

    return NextResponse.json(
      {
        liked: Boolean(existing),
        likeCount,
        isPublic: set.isPublic,
        isOwner: set.ownerId === userId,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/sets/[id]/like error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST toggle like (like if not liked, unlike if already liked) */
export async function POST(
  req: NextRequest,
  context: RouteContext<"/api/sets/[id]/like">
) {
  let setId = "";
  let userId = "";
  try {
    const params = await context.params;
    setId = params.id;
    if (!setId) return NextResponse.json({ error: "Missing set id." }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    userId = String(body?.userId || "");
    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

    // Fetch set: visibility + owner
    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: { id: true, isPublic: true, ownerId: true },
    });
    if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });

    // Prevent liking own set
    if (set.ownerId === userId) {
      return NextResponse.json({ error: "You cannot like your own set." }, { status: 400 });
    }

    // Only allow likes on public sets
    if (!set.isPublic) {
      return NextResponse.json({ error: "This set is private." }, { status: 403 });
    }

    // Toggle
    const existing = await prisma.like.findFirst({ where: { userId, setId } });
    if (existing) {
      await prisma.like.deleteMany({ where: { userId, setId } });
    } else {
      await prisma.like.create({ data: { userId, setId } });
    }

    const likeCount = await prisma.like.count({ where: { setId } });
    return NextResponse.json({ liked: !existing, likeCount }, { status: 200 });
  } catch (err: any) {
    // Handle unique violation gracefully (race conditions)
    if (err?.code === "P2002" && setId) {
      const likeCount = await prisma.like.count({ where: { setId } });
      return NextResponse.json({ liked: true, likeCount }, { status: 200 });
    }
    console.error("POST /api/sets/[id]/like error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE explicit unlike */
export async function DELETE(
  req: NextRequest,
  context: RouteContext<"/api/sets/[id]/like">
) {
  try {
    const { id: setId } = await context.params;
    if (!setId) return NextResponse.json({ error: "Missing set id." }, { status: 400 });

    const url = new URL(req.url);
    const userId = String(url.searchParams.get("userId") || "");
    if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

    await prisma.like.deleteMany({ where: { userId, setId } });
    const likeCount = await prisma.like.count({ where: { setId } });
    return NextResponse.json({ liked: false, likeCount }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/sets/[id]/like error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
