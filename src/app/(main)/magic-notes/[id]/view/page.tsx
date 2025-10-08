// /src/app/(main)/magic-notes/[id]/view/page.tsx
export const revalidate = 0;             // disable ISR caching
export const dynamic = "force-dynamic";  // always render on request

import { prisma } from "@/lib/prisma";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/** Join saved sections into one Markdown doc (same logic as editor). */
function sectionsToDoc(sections: { heading: string | null; contentMd: string; position: number }[]): string {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  return ordered
    .map((s) => {
      const h = s.heading?.trim();
      const header = h ? `## ${h}\n\n` : "";
      return header + (s.contentMd ?? "").trim();
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export default async function ViewMagicNotePage({
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

  const doc = sectionsToDoc(
    note.sections.map((s) => ({
      heading: s.heading,
      contentMd: s.contentMd,
      position: s.position,
    }))
  );

  // Local type for code renderer
  type CodeProps = React.HTMLAttributes<HTMLElement> & {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  };

  const Code = ({ inline, className, children, ...rest }: CodeProps) => {
    if (inline) {
      return (
        <code className="px-1 py-0.5 rounded bg-white/10" {...rest}>
          {children}
        </code>
      );
    }
    return (
      <pre className="overflow-auto rounded-md bg-[#120a24] p-3 ring-1 ring-white/10">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    );
  };

  const components: Components = {
    h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2" {...props} />
    ),
    h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
      <h2 className="text-xl md:text-2xl font-semibold mt-6 mb-2" {...props} />
    ),
    h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
      <h3 className="text-lg md:text-xl font-semibold mt-5 mb-1.5" {...props} />
    ),
    code: Code,
    hr: (props: React.ComponentPropsWithoutRef<"hr">) => (
      <hr className="my-6 border-white/10" {...props} />
    ),
    table: (props: React.ComponentPropsWithoutRef<"table">) => (
      <div className="overflow-x-auto my-3">
        <table className="table-auto w-full border-collapse" {...props} />
      </div>
    ),
    a: (props: React.ComponentPropsWithoutRef<"a">) => (
      <a {...props} target="_blank" rel="noreferrer" className="underline" />
    ),
    ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
      <ul className="list-disc pl-6 my-3 space-y-1" {...props} />
    ),
    ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
      <ol className="list-decimal pl-6 my-3 space-y-1" {...props} />
    ),
    p: (props: React.ComponentPropsWithoutRef<"p">) => <p className="my-3" {...props} />,
  };

  return (
    <main className="px-4 md:px-6 py-8 text-white">
      {/* Compact header above the paper column */}
      <div className="mx-auto w-full max-w-[980px] mb-4">
        <h1 className="text-[22px] md:text-[26px] font-semibold leading-tight">{note.title}</h1>
        <div className="text-sm text-white/60 mt-1">
          Last updated {note.updatedAt.toLocaleDateString()}
        </div>
      </div>

      {/* Single “paper” column — Notion/PDF style */}
      <div className="mx-auto w-full max-w-[980px] rounded-[14px] border border-white/10 bg-[#15102a] shadow-[0_10px_40px_rgba(0,0,0,0.35)] px-5 md:px-7 py-6 md:py-8">
        <div className="prose prose-invert max-w-none text-[16px] leading-7">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {doc}
          </ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
