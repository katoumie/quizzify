// /src/app/api/magic-notes/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const note = await prisma.magicNote.findFirst({
    where: { id, ownerId: userId },
    include: { sections: { orderBy: { position: "asc" } } },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ note });
}

/**
 * PATCH body:
 * {
 *   "title"?: string,
 *   "sections"?: Array<
 *     | { id: string; heading: string|null; contentMd: string; position: number } // update/reorder
 *     | { _op:"create"; heading: string|null; contentMd: string; position?: number }
 *     | { _op:"delete"; id: string }
 *   >
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exists = await prisma.magicNote.findFirst({
    where: { id, ownerId: userId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const updates: any[] = [];

  if (typeof body.title === "string") {
    updates.push(
      prisma.magicNote.update({
        where: { id },
        data: { title: body.title.slice(0, 160) },
      })
    );
  }

  if (Array.isArray(body.sections)) {
    for (const s of body.sections) {
      if (s && s._op === "create") {
        updates.push(
          prisma.magicNoteSection.create({
            data: {
              noteId: id,
              heading: s.heading ?? null,
              contentMd: String(s.contentMd ?? "").slice(0, 20000),
              position: Number.isFinite(s.position) ? s.position : 9_999,
            },
          })
        );
      } else if (s && s._op === "delete" && s.id) {
        updates.push(prisma.magicNoteSection.delete({ where: { id: s.id } }));
      } else if (s && s.id) {
        updates.push(
          prisma.magicNoteSection.update({
            where: { id: s.id },
            data: {
              heading: typeof s.heading === "string" ? s.heading.slice(0, 120) : s.heading ?? null,
              contentMd: typeof s.contentMd === "string" ? s.contentMd.slice(0, 20000) : undefined,
              position: Number.isFinite(s.position) ? s.position : undefined,
            },
          })
        );
      }
    }
  }

  if (!updates.length) {
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(updates);
  return NextResponse.json({ ok: true });
}
