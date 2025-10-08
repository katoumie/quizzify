// /src/app/(main)/magic-notes/[id]/edit/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import MagicNoteEditor from "@/components/magic-notes/MagicNoteEditor";

export default async function EditMagicNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const note = await prisma.magicNote.findUnique({
    where: { id },
    include: { sections: { orderBy: { position: "asc" } } },
  });

  if (!note) return <div className="p-6 text-white">Not found.</div>;

  return (
    <main className="px-6 py-8 text-white">
      <MagicNoteEditor
        key={note.updatedAt.toISOString()} // force fresh mount when updated
        initialNote={{
          id: note.id,
          title: note.title,
          sections: note.sections.map((s) => ({
            id: s.id,
            heading: s.heading,
            contentMd: s.contentMd,
            position: s.position,
          })),
          updatedAt: note.updatedAt.toISOString(),
        }}
      />
    </main>
  );
}
