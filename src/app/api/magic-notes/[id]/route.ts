// /src/app/api/magic-notes/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";

/**
 * Notes:
 * - Fixes params typing (no Promise).
 * - GET requires ownership (owner-only fetch).
 * - PATCH supports:
 *     • title (string)
 *     • sections[] (create/update/delete/reorder)
 *     • contentMd (string)  -> replaces all sections with a single doc-style section
 * - DELETE removes the note (owner-only).
 */

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const note = await prisma.magicNote.findFirst({
      where: { id, ownerId: userId },
      include: { sections: { orderBy: { position: "asc" } } },
    });

    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ note });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

/**
 * PATCH body supports:
 * {
 *   "title"?: string,
 *   "contentMd"?: string, // single doc; replaces all sections with one
 *   "sections"?: Array<
 *     | { id: string; heading: string|null; contentMd: string; position: number } // update/reorder
 *     | { _op:"create"; heading: string|null; contentMd: string; position?: number }
 *     | { _op:"delete"; id: string }
 *   >
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const exists = await prisma.magicNote.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({} as any));
    const tx: any[] = [];

    // Title
    if (typeof body.title === "string") {
      tx.push(
        prisma.magicNote.update({
          where: { id },
          data: { title: body.title.slice(0, 160) },
        })
      );
    }

    // Single-document mode: replace all sections with one
    if (typeof body.contentMd === "string") {
      const content = body.contentMd.slice(0, 20000);
      tx.push(
        prisma.magicNoteSection.deleteMany({ where: { noteId: id } })
      );
      tx.push(
        prisma.magicNoteSection.create({
          data: {
            noteId: id,
            heading: null,
            contentMd: content,
            position: 1,
          },
        })
      );
    } else if (Array.isArray(body.sections)) {
      // Structured sections mode
      for (const s of body.sections) {
        if (s && s._op === "create") {
          tx.push(
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
          tx.push(prisma.magicNoteSection.delete({ where: { id: s.id } }));
        } else if (s && s.id) {
          tx.push(
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

    if (!tx.length) return NextResponse.json({ ok: true });
    await prisma.$transaction(tx);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure ownership
    const note = await prisma.magicNote.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.magicNoteSection.deleteMany({ where: { noteId: id } }),
      prisma.magicNote.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
