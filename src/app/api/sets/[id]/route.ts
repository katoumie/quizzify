// /src/app/api/sets/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET one set (with cards) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const set = await prisma.studySet.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        isPublic: true,
        createdAt: true,
        cards: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            term: true,
            definition: true,
            position: true,
            imageUrl: true, // 👈 include image URLs
            createdAt: true,
          },
        },
      },
    });

    if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(set, { status: 200 });
  } catch (err) {
    console.error("GET /api/sets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH update title/description/isPublic/cards (replace cards) */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    const title =
      typeof body?.title === "string" ? body.title.trim() : undefined;

    const description =
      body?.description === null
        ? null
        : typeof body?.description === "string"
        ? body.description.trim()
        : undefined;

    const isPublic =
      typeof body?.isPublic === "boolean" ? body.isPublic : undefined;

    const cards = Array.isArray(body?.cards) ? body.cards : undefined;

    if (
      typeof title === "undefined" &&
      typeof description === "undefined" &&
      typeof isPublic === "undefined" &&
      !cards
    ) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const tx: any[] = [];

    let prev: { isPublic: boolean; ownerId: string } | null = null;
    if (typeof isPublic !== "undefined") {
      prev = await prisma.studySet.findUnique({
        where: { id },
        select: { isPublic: true, ownerId: true },
      });
    }

    if (
      typeof title !== "undefined" ||
      typeof description !== "undefined" ||
      typeof isPublic !== "undefined"
    ) {
      tx.push(
        prisma.studySet.update({
          where: { id },
          data: {
            ...(typeof title !== "undefined" ? { title } : {}),
            ...(typeof description !== "undefined" ? { description } : {}),
            ...(typeof isPublic !== "undefined" ? { isPublic } : {}),
          },
        })
      );
    }

    if (cards) {
      const clean = (cards as any[])
        .map((c, i) => ({
          term: String(c?.term || "").trim(),
          definition: String(c?.definition || "").trim(),
          position: Number.isFinite(c?.position) ? Number(c.position) : i,
          imageUrl: c?.imageUrl ? String(c.imageUrl) : null, // 👈
        }))
        .filter((c) => c.term || c.definition);

      tx.push(
        prisma.card.deleteMany({ where: { setId: id } }),
        prisma.card.createMany({
          data: clean.map((c) => ({
            term: c.term,
            definition: c.definition,
            setId: id,
            position: c.position,
            imageUrl: c.imageUrl, // 👈
          })),
        })
      );
    }

    if (prev && prev.isPublic && isPublic === false) {
      tx.push(
        prisma.like.deleteMany({
          where: { setId: id, NOT: { userId: prev.ownerId } },
        })
      );
    }

    await prisma.$transaction(tx);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PATCH /api/sets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE a set (delete cards first, then set) */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    await prisma.$transaction([
      prisma.card.deleteMany({ where: { setId: id } }),
      prisma.studySet.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/sets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
