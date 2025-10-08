// /src/components/magic-notes/MagicNoteEditor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ---------- Types ---------- */
type Section = { id?: string; heading: string | null; contentMd: string; position: number; _op?: "create" | "delete" };
type NoteVM = { id: string; title: string; sections: Section[]; updatedAt: string };

/* ---------- Helpers: merge sections <-> single doc ---------- */
function sectionsToDoc(sections: Section[]): string {
  const ordered = [...sections].filter(s => s._op !== "delete").sort((a, b) => a.position - b.position);
  return ordered
    .map((s) => {
      const h = s.heading?.trim();
      const header = h ? `## ${h}\n\n` : "";
      return header + (s.contentMd ?? "").trim();
    })
    .join("\n\n---\n\n");
}

function docToSections(doc: string): Pick<Section, "heading" | "contentMd" | "position" | "_op">[] {
  const text = (doc ?? "").replace(/\r\n/g, "\n").trim();
  const hrParts = text.includes("\n---\n") ? text.split(/\n-{3,}\n/g) : [text];

  const out: Pick<Section, "heading" | "contentMd" | "position" | "_op">[] = [];
  let pos = 0;

  for (const chunk of hrParts) {
    const lines = chunk.split("\n");
    let currHeading: string | null = null;
    let currBody: string[] = [];

    const flush = () => {
      const body = currBody.join("\n").trim();
      if (currHeading || body) out.push({ heading: currHeading, contentMd: body, position: pos++, _op: "create" });
      currHeading = null;
      currBody = [];
    };

    for (const ln of lines) {
      const m = ln.match(/^\s*##\s+(.+)\s*$/);
      if (m) {
        if (currHeading !== null || currBody.length) flush();
        currHeading = m[1].trim();
      } else {
        currBody.push(ln);
      }
    }
    flush();
  }

  if (!out.length) out.push({ heading: null, contentMd: "", position: 0, _op: "create" });
  out.forEach((s, i) => (s.position = i));
  return out;
}

/* ---------- Component ---------- */
export default function MagicNoteEditor({ initialNote }: { initialNote: NoteVM }) {
  const router = useRouter();

  const [title, setTitle] = useState(initialNote.title);
  const [doc, setDoc] = useState(sectionsToDoc(initialNote.sections));

  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | null>(null);

  // ⬇️ NEW: resync local state if the server-sent note changes (e.g., after nav back)
  useEffect(() => {
    setTitle(initialNote.title);
    setDoc(sectionsToDoc(initialNote.sections));
    setDirty(false);
  }, [initialNote.id, initialNote.updatedAt]);

  // Guard against closing with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Save function (used by autosave & button & Cmd/Ctrl+S)
  const saveNow = useCallback(async (): Promise<boolean> => {
    setSaving("saving");
    try {
      const parsed = docToSections(doc);
      const payload = {
        title,
        sections: parsed.map((s) => ({
          _op: "create" as const,
          heading: s.heading,
          contentMd: s.contentMd,
          position: s.position,
        })),
      };
      const res = await fetch(`/api/magic-notes/${initialNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(await res.text());
      setSaving("saved");
      setDirty(false);
      window.setTimeout(() => setSaving("idle"), 900);
      return true;
    } catch (e) {
      console.error("[MagicNotes] save failed", e);
      setSaving("error");
      return false;
    }
  }, [doc, title, initialNote.id]);

  // Debounced autosave (700ms)
  useEffect(() => {
    if (!dirty) return;
    setSaving("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveNow(), 700) as unknown as number;
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [dirty, saveNow]);

  // Cmd/Ctrl+S to save (stays on page)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (timer.current) window.clearTimeout(timer.current);
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  /* ===== Compact sticky header (TITLE ONLY) ===== */
  const Header = useMemo(
    () => (
      <div className="sticky top-0 z-[5] -mx-4 md:-mx-8 px-4 md:px-8 py-3">
        <div className="mx-auto w-full max-w-[980px]">
          <div className="rounded-[10px] border border-white/10 bg-[#0f0820]/60 backdrop-blur px-3.5 py-2">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              placeholder="Untitled notes"
              className={[
                "w-full bg-transparent outline-none",
                "text-[18px] md:text-[20px] font-medium leading-tight",
                "placeholder:text-white/45 tracking-tight",
              ].join(" ")}
            />
          </div>
        </div>
      </div>
    ),
    [title]
  );

  return (
    <div className="mx-auto w-full">
      {Header}

      {/* Tip line aligned with editor width */}
      <div className="mx-auto w-full max-w-[980px] px-4 md:px-0 text-[12px] text-white/55">
        Tip: Use <code>## Heading</code> to start a new section, or <code>---</code> to insert a divider. Markdown is supported.
      </div>

      {/* Editor (single subtle card) */}
      <div className="mx-auto mt-3 w-full max-w-[980px] px-4 md:px-0">
        <textarea
          value={doc}
          onChange={(e) => {
            setDoc(e.target.value);
            setDirty(true);
          }}
          placeholder="Write your magic notes here…"
          className={[
            "w-full min-h-[65vh] qz-scroll resize-y",
            "rounded-[10px] px-3 py-2",
            "text-[15px] leading-7 text-white/95",
            "bg-[#18062e] ring-1 ring-white/12 outline-none",
            "placeholder:text-white/60",
            "focus:ring-2 focus:ring-white/20 focus:outline-none",
          ].join(" ")}
        />
      </div>

      {/* Footer: status + tiny Save button, right-aligned under editor */}
      <div className="mx-auto w-full max-w-[980px] px-4 md:px-0 mt-3">
        <div className="flex items-center justify-end gap-3">
          <div className="text-xs text-white/70 min-w-[64px] text-right">
            {saving === "saving" && "Saving…"}
            {saving === "saved" && "Saved"}
            {saving === "error" && <span className="text-red-300">Error</span>}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (timer.current) window.clearTimeout(timer.current);
              const ok = await saveNow();
              if (ok) router.push(`/magic-notes/${initialNote.id}/view`);
            }}
            className={[
              "inline-flex items-center gap-1.5 rounded-[6px]",
              "h-8 px-2.5",
              "text-white/90 hover:text-white",
              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
              "ring-1 ring-white/20 hover:ring-white/10 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
            disabled={saving === "saving"}
            aria-busy={saving === "saving"}
          >
            <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7a2 2 0 0 1 2-2h7l5 5v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 7h6v4H8z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-sm font-medium">Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}
