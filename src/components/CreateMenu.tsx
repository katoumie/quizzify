// /src/components/CreateMenu.tsx
"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import MagicNotesUploadModal from "@/components/magic-notes/MagicNotesUploadModal";
import { useRouter, usePathname } from "next/navigation";

// Full-screen overlay visuals (same as SetForm)
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";
import DarkVeil from "@/components/DarkVeil";

export default function CreateMenu({
  onCreateMagicNotes, // optional: parent can handle upload → API → redirect
}: {
  onCreateMagicNotes?: (payload: { file: File; title?: string }) => Promise<{ noteId: string } | void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(pathname);

  // 🔁 Auto-dismiss the generating overlay on route change
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (generating) setGenerating(false);
    }
  }, [pathname, generating]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && !(menuRef.current?.contains(t) || btnRef.current?.contains(t))) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setUploadOpen(false);
        // Do not touch `generating` here so uploads aren’t aborted visually
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleMagicNotesConfirm = async (payload: { file: File; title?: string }) => {
    setOpen(false);
    setUploadOpen(false);
    setGenerating(true); // show full-screen overlay

    try {
      if (onCreateMagicNotes) {
        const res = await onCreateMagicNotes(payload);
        if (res && "noteId" in res && res.noteId) {
          router.push(`/magic-notes/${res.noteId}/edit`);
        } else {
          router.push("/library?tab=notes");
        }
        // Safety: just in case navigation is blocked for some reason
        setTimeout(() => setGenerating(false), 8000);
        return;
      }

      const fd = new FormData();
      fd.append("file", payload.file);
      if (payload.title) fd.append("title", payload.title);

      const resp = await fetch("/api/magic-notes", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const text = await resp.text();
      if (!resp.ok) {
        let errMsg = text;
        try {
          const j = JSON.parse(text);
          errMsg = j?.error || errMsg;
        } catch {}
        console.error("[MagicNotes] Server error:", resp.status, errMsg);
        setGenerating(false);
        alert(`Upload failed (${resp.status}). ${errMsg || "Please try again."}`);
        return;
      }

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("[MagicNotes] Non-JSON success payload:", text);
      }
      const noteId = data?.id || data?.noteId;

      if (noteId) {
        router.push(`/magic-notes/${noteId}/edit`);
      } else {
        router.push("/library?tab=notes");
      }
      // Safety: clear overlay if route change doesn’t fire quickly
      setTimeout(() => setGenerating(false), 8000);
    } catch (err) {
      console.error("[MagicNotes] Network/client error:", err);
      setGenerating(false);
      alert("Something went wrong while creating magic notes.");
    }
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open create menu"
        className={[
          "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px]",
          "text-white/90 hover:text-white",
          "bg-[#18062e]",
          "ring-1 ring-white/12 hover:bg-white/10 hover:ring-white/10",
          "transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
        ].join(" ")}
      >
        <SvgFileIcon src="/icons/add.svg" className="h-[14px] w-[14px]" />
        <CaretDownIcon className="h-3.5 w-3.5 text-white/80" />
      </button>

      {/* Dropdown */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="Create menu"
        className={`absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border border-white/15 bg-[var(--bg)] shadow-lg transition z-[70] ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
        style={{ backgroundColor: "var(--bg, #18062e)" }}
      >
        <div className="p-2">
          {/* Create set */}
          <Link
            href="/sets/new"
            role="menuitem"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-regular text-white hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            <SvgFileIcon src="/icons/add.svg" className="h-[18px] w-[18px] text-white" />
            <span>Create set</span>
          </Link>

          {/* Create magic notes → opens modal */}
          <button
            role="menuitem"
            onClick={() => {
              setUploadOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-regular text-white hover:bg-white/10 text-left"
          >
            <SvgFileIcon src="/icons/magic_notes.svg" className="h-[18px] w-[18px] text-white" />
            <span>Create magic notes</span>
          </button>
        </div>
      </div>

      {/* Magic Notes Modal */}
      <MagicNotesUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onConfirm={handleMagicNotesConfirm}
      />

      {/* Full-screen loading overlay (animated, same as SetForm) */}
      {generating && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/80 backdrop-blur-sm">
          {/* DarkVeil as a click-through visual filter */}
          <div className="pointer-events-none absolute inset-0 opacity-35">
            <div className="h-full w-full">
              <DarkVeil
                speed={1.2}
                hueShift={0}
                noiseIntensity={0}
                scanlineFrequency={0}
                scanlineIntensity={0}
                warpAmount={0}
                resolutionScale={1}
              />
            </div>
          </div>

          {/* Center text */}
          <div className="relative px-6 text-center flex flex-col items-center">
            <SplitText
              text="Generating your magic notes."
              delay={70}
              duration={1.2}
              className="text-white text-[clamp(28px,4vw,48px)] font-semibold leading-tight"
            />
            <ShinyText
              text="This might take a while..."
              disabled={false}
              speed={3.5}
              className="block mt-5 text-[22px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
