// /src/app/api/sets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type InCard = { term: string; definition: string; position?: number; imageUrl?: string | null };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const ownerId = String(body?.ownerId || "");
    const title = String(body?.title || "").trim();

    const description =
      body?.description === null
        ? null
        : typeof body?.description === "string"
        ? body.description.trim()
        : null;

    const isPublic =
      typeof body?.isPublic === "boolean" ? body.isPublic : false;

    const rawCards = Array.isArray(body?.cards) ? (body.cards as InCard[]) : [];

    if (!ownerId) return NextResponse.json({ error: "Missing ownerId." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!rawCards.length) {
      return NextResponse.json({ error: "Please include at least one card." }, { status: 400 });
    }

    const clean = rawCards
      .map((c, i) => ({
        term: String(c?.term || "").trim(),
        definition: String(c?.definition || "").trim(),
        position: Number.isFinite(c?.position) ? Number(c.position) : i,
        imageUrl: c?.imageUrl ? String(c.imageUrl) : null, // 👈
      }))
      .filter((c) => c.term || c.definition);

    if (!clean.length) {
      return NextResponse.json(
        { error: "Please include at least one non-empty card." },
        { status: 400 }
      );
    }

    const set = await prisma.studySet.create({
      data: {
        title,
        description,
        isPublic,
        ownerId,
        cards: {
          create: clean.map((c) => ({
            term: c.term,
            definition: c.definition,
            position: c.position,
            imageUrl: c.imageUrl, // 👈
          })),
        },
      },
      select: { id: true, isPublic: true },
    });

    return NextResponse.json({ ok: true, id: set.id, isPublic: set.isPublic }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sets error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
