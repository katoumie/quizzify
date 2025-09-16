"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "qz_auth";

// Limits
const AI_MAX_CARDS = 50;      // AI hard cap (client; server also caps)
const SOFT_CARD_LIMIT = 200;  // warn after this many manual cards
const HARD_CARD_LIMIT = 500;  // absolute max manual cards
const DEF_MAX = 500;          // definition character cap

type Card = {
  id?: string;
  term: string;
  definition: string;
  imageUrl?: string | null;   // persisted URL (if already uploaded)
  _file?: File | null;        // local file (not persisted yet)
  _preview?: string | null;   // local preview URL
};

export type SetFormInitialData = {
  id?: string;
  title: string;
  description?: string | null;
  isPublic?: boolean;
  cards: Card[];
};

export default function SetForm({
  mode,
  initialData,
}: {
  mode: "create" | "edit";
  initialData?: SetFormInitialData;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState<string>(initialData?.description ?? "");
  const [cards, setCards] = useState<Card[]>(
    initialData?.cards?.length
      ? initialData.cards.map((c) => ({ ...c, _file: null, _preview: null }))
      : [
          { term: "", definition: "", _file: null, _preview: null },
          { term: "", definition: "", _file: null, _preview: null },
        ]
  );
  const [isPublic, setIsPublic] = useState<boolean>(initialData?.isPublic ?? false);
  const [saving, setSaving] = useState(false);

  // Full-screen overlay + progress
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  // guard flags
  const [softWarned, setSoftWarned] = useState(false);

  // drag & drop
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // AI upload
  const aiFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialData) return;
    setTitle(initialData.title ?? "");
    setDescription(initialData.description ?? "");
    setIsPublic(Boolean(initialData.isPublic));
    setCards(
      (initialData.cards?.length ? initialData.cards : [{ term: "", definition: "" }]).map((c) => ({
        ...c,
        _file: null,
        _preview: null,
      }))
    );
  }, [initialData?.id]);

  /** ---------- manual card helpers with caps ---------- */

  const enforceManualCaps = (nextCards: Card[]) => {
    if (nextCards.length > HARD_CARD_LIMIT) {
      alert(`You’ve reached the maximum of ${HARD_CARD_LIMIT} cards in a set.`);
      return nextCards.slice(0, HARD_CARD_LIMIT);
    }
    if (!softWarned && nextCards.length > SOFT_CARD_LIMIT) {
      alert(
        `Heads up: very large sets (${SOFT_CARD_LIMIT}+ cards) can be harder to review.\nYou can keep going up to ${HARD_CARD_LIMIT}, but consider splitting into smaller sets.`
      );
      setSoftWarned(true);
    }
    return nextCards;
  };

  const addCard = () =>
    setCards((c) => {
      const next = [...c, { term: "", definition: "", _file: null, _preview: null }];
      return enforceManualCaps(next);
    });

  const removeCard = (index: number) =>
    setCards((c) => {
      const next = c.length > 1 ? c.filter((_, i) => i !== index) : c;
      return next;
    });

  const updateCardField =
    (index: number, field: "term" | "definition") =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setCards((c) => {
        const next = [...c];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    };

  /** ---------- image handlers ---------- */

  const onPickImage = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Please keep images under 8 MB.");
      return;
    }
    const preview = URL.createObjectURL(file);
    setCards((c) => {
      const next = [...c];
      next[index] = { ...next[index], _file: file, _preview: preview };
      return next;
    });
  };

  const onClearImage = (index: number) => () => {
    setCards((c) => {
      const next = [...c];
      if (next[index]._preview) URL.revokeObjectURL(next[index]._preview!);
      next[index] = { ...next[index], _file: null, _preview: null, imageUrl: null };
      return next;
    });
  };

  /** ---------- DnD handlers (handle-only drag) ---------- */

  const onHandleDragStart = (index: number) => (e: DragEvent<HTMLButtonElement>) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };
  const onCardDragOver = (index: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dropIndex !== index) setDropIndex(index);
  };
  const onCardDragLeave = (index: number) => (_: DragEvent<HTMLDivElement>) => {
    if (dropIndex === index) setDropIndex(null);
  };
  const onCardDrop = (index: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    setCards((c) => {
      const next = [...c];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDropIndex(null);
  };
  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  /** ---------- AI upload (multi-file; up to 3) ---------- */

  const handleAIUploadClick = () => aiFileRef.current?.click();

  // Helper: call API for one file
  async function generateFromSingleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/generate-from-ai`, { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to process file.");
    }
    return (await res.json()) as {
      title?: string;
      description?: string | null;
      cards?: { term: string; definition: string }[];
    };
  }

  const handleAIFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!selected.length) return;

    // HARD cap to 3 files — ignore extras, and notify
    let files = selected.slice(0, 3);
    if (selected.length > 3) {
      alert("You selected more than 3 files. Only the first 3 will be processed.");
    }

    // simple size guard: 25MB each (you can tweak)
    const tooBig = files.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) {
      alert(`"${tooBig.name}" is too large. Please upload files under 25MB.`);
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: files.length, label: "Preparing…" });

    try {
      const currentHasContent = cards.some((c) => (c.term?.trim() || c.definition?.trim()));
      let workingCards: Card[] = currentHasContent ? [...cards] : [];

      // process sequentially — allows a functional progress bar
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress({ current: i, total: files.length, label: `Reading "${f.name}"…` });
        const data = await generateFromSingleFile(f);
        setProgress({ current: i + 0.5, total: files.length, label: `Synthesizing cards from "${f.name}"…` });

        const incoming =
          (data.cards ?? []).map((c) => ({
            term: String(c.term || ""),
            definition: String(c.definition || "").slice(0, DEF_MAX),
            _file: null,
            _preview: null,
          })) || [];

        // merge in while respecting AI_MAX_CARDS
        const remaining = Math.max(0, AI_MAX_CARDS - workingCards.length);
        if (remaining > 0) {
          workingCards.push(...incoming.slice(0, remaining));
        }
        // fill title/description if empty
        if (!title && typeof data.title === "string") setTitle(data.title);
        if (!description && typeof data.description === "string") setDescription(data.description);

        setProgress({ current: i + 1, total: files.length, label: `Finished "${f.name}"` });
        if (workingCards.length >= AI_MAX_CARDS) break;
      }

      if (workingCards.length === 0) {
        workingCards = [{ term: "", definition: "", _file: null, _preview: null }];
      }
      setCards(workingCards);
    } catch (err: any) {
      alert(err?.message || "Failed to process file.");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  /** ---------- Upload images to Blob (your existing route) ---------- */

  async function uploadFilesAndGetUrls(card: Card): Promise<string | null> {
    if (!card._file) return card.imageUrl ?? null;

    const fd = new FormData();
    fd.append("file", card._file);
    fd.append("filename", card._file.name);
    fd.append("prefix", "cards");

    const res = await fetch("/api/blob/upload", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      alert("Upload failed");
      return card.imageUrl ?? null;
    }

    const { url } = await res.json();
    return (url as string) || null;
  }

  /** ---------- Submit ---------- */

  const onSubmit = async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return alert("Please sign in first.");
    const ownerId = JSON.parse(raw)?.id as string | undefined;
    if (!ownerId) return alert("Invalid session.");

    if (!title.trim()) return alert("Please enter a title.");

    // Upload any new files first and collect URLs
    const finalized = await Promise.all(
      cards.map(async (c) => {
        let imageUrl = c.imageUrl ?? null;
        if (c._file) {
          imageUrl = await uploadFilesAndGetUrls(c);
        }
        return {
          term: c.term.trim(),
          definition: c.definition.trim().slice(0, DEF_MAX),
          imageUrl,
        };
      })
    );

    const hardLimited = finalized.slice(0, HARD_CARD_LIMIT);
    const cleanCards = hardLimited.filter((c) => c.term || c.definition);
    if (cleanCards.length === 0) return alert("Please add at least one card.");

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch(`/api/sets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerId,
            title: title.trim(),
            description: description.trim() || null,
            isPublic,
            cards: cleanCards.map((c, i) => ({ ...c, position: i })),
          }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data?.error || "Failed to create set.");
      } else {
        if (!initialData?.id) return alert("Missing set id.");
        const res = await fetch(`/api/sets/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            isPublic,
            cards: cleanCards.map((c, i) => ({ ...c, position: i })),
          }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data?.error || "Failed to update set.");
      }
      router.push("/library");
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const privateOn = !isPublic;

  /** ---------- helpers: auto-grow textarea ---------- */
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(Math.max(el.scrollHeight, 44), 240) + "px"; // 44px min, 240px max
  };

  return (
    <section className="mx-auto max-w-5xl">
      {/* Top row: title + CTA */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {mode === "create" ? "Create a new study set" : "Edit study set"}
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || generating}
            className="h-10 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--btn-contrast)] hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
              ? "Create"
              : "Save"}
          </button>
        </div>
      </div>

      {/* Title / Description */}
      <div className="mt-6 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full h-12 rounded-xl bg-[var(--bg-card)] text-white placeholder-white/70 px-4 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          rows={3}
          className="w-full rounded-xl bg-[var(--bg-card)] text-white placeholder-white/70 px-4 py-3 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
        />
      </div>

      {/* Toolbar (AI + Privacy) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAIUploadClick}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 hover:bg-white/14 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="grid h-5 w-5 place-items-center">
              <AIIcon />
            </span>
            <span>{generating ? "Analyzing…" : "Generate from AI"}</span>
          </button>
          <input
            ref={aiFileRef}
            type="file"
            accept=".pdf,.docx,.pptx"
            multiple
            className="hidden"
            onChange={handleAIFileChange}
          />
          <div className="text-xs text-white/60">
            PDF / DOCX / PPTX — <strong>up to 3 files</strong>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <span>Private</span>
            <Switch checked={privateOn} onChange={(next) => setIsPublic(!next)} ariaLabel="Toggle private" />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="mt-4 space-y-4">
        {cards.map((card, i) => (
          <div
            key={card.id ?? i}
            onDragOver={onCardDragOver(i)}
            onDragLeave={onCardDragLeave(i)}
            onDrop={onCardDrop(i)}
            onDragEnd={onDragEnd}
            className={`rounded-2xl bg-[var(--bg-card)] ring-1 ring-white/10 transition-shadow ${
              dropIndex === i && dragIndex !== null ? "ring-[var(--brand)]/50 shadow-[0_0_0_2px_var(--brand)]" : ""
            }`}
          >
            <CardRow
              index={i}
              term={card.term}
              definition={card.definition}
              previewUrl={card._preview || card.imageUrl || null}
              onChangeTerm={updateCardField(i, "term")}
              onChangeDefinition={(e) => {
                // hard limit + auto-grow
                if (e.target.value.length > DEF_MAX) return;
                updateCardField(i, "definition")(e);
                autoGrow(e.target as HTMLTextAreaElement);
              }}
              onPickImage={onPickImage(i)}
              onClearImage={onClearImage(i)}
              onRemove={() => removeCard(i)}
              onHandleDragStart={onHandleDragStart(i)}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={addCard}
          className="rounded-full px-5 py-2 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10"
        >
          Add a card
        </button>
      </div>

      {/* Full-screen loading overlay (very high z-index to cover navbar too) */}
      {generating && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="w-[min(520px,92vw)] rounded-xl bg-white/10 p-4 ring-1 ring-white/15 text-white">
            <div className="mb-2 text-sm font-medium">
              {progress?.label || "Analyzing file(s) and generating cards…"}
            </div>
            <Progress value={progress ? (progress.current / progress.total) * 100 : 12} />
            <div className="mt-2 text-xs text-white/70">
              {progress ? `Processed ${Math.min(progress.current, progress.total)} of ${progress.total}` : "Working…"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ================== Subcomponents & Icons ================== */

function CardRow({
  index,
  term,
  definition,
  previewUrl,
  onChangeTerm,
  onChangeDefinition,
  onPickImage,
  onClearImage,
  onRemove,
  onHandleDragStart,
}: {
  index: number;
  term: string;
  definition: string;
  previewUrl: string | null;
  onChangeTerm: (e: ChangeEvent<HTMLInputElement>) => void;
  onChangeDefinition: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onPickImage: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  onRemove: () => void;
  onHandleDragStart: (e: DragEvent<HTMLButtonElement>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defLen = definition.length;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 text-white/90">
        <div className="flex items-center gap-2">
          <button
            type="button"
            draggable                 // ← only the handle is draggable
            onDragStart={onHandleDragStart}
            className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/10 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            tabIndex={0}
          >
            <DragHandleIcon />
          </button>
          <div className="font-semibold">{index + 1}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/10"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Inputs + Right-side Image box */}
      <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-[1fr_1fr_160px] md:items-start">
        <div>
          <input
            value={term}
            onChange={onChangeTerm}
            placeholder="Enter term"
            className="h-11 w-full rounded-lg bg-[var(--bg)] px-3 text-white placeholder-white/70 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
          />
          <div className="mt-1 text-[11px] uppercase tracking-wide text-white/50">Term</div>
        </div>

        <div>
          <textarea
            value={definition}
            onChange={onChangeDefinition}
            placeholder="Enter definition"
            rows={1}
            maxLength={DEF_MAX}
            className="min-h-[44px] max-h-60 w-full resize-none overflow-hidden rounded-lg bg-[var(--bg)] px-3 py-2 text-white placeholder-white/70 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-white/50">
            <span>Definition</span>
            <span className="normal-case tracking-normal text-white/60">{defLen}/{DEF_MAX}</span>
          </div>
        </div>

        {/* Right-side image picker / preview */}
        <div className="md:ml-2">
          <div
            className="group relative grid aspect-square w-full place-items-center rounded-lg ring-1 ring-dashed ring-white/30 bg-white/5 overflow-hidden"
            title="Add image"
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/50 p-2 group-hover:flex">
                  <button
                    type="button"
                    onClick={onClearImage}
                    className="rounded-md px-2 py-1 text-xs font-medium text-white ring-1 ring-white/30 hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/70 hover:bg-white/5"
              >
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">Image</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>
      </div>
    </>
  );
}

function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-[26px] w-[46px] items-center rounded-full transition-colors
        ${checked ? "bg-[var(--brand)]" : "bg-white/30"} 
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform
          ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}

function Progress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full rounded-full bg-white/15">
      <div
        className="h-2 rounded-full bg-[var(--brand)] transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7" r="1" />
      <circle cx="15" cy="7" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="17" r="1" />
      <circle cx="15" cy="17" r="1" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" />
    </svg>
  );
}
function AIIcon() {
  // Uses your file-based icon: place it at /public/icons/wand_24.svg
  return <img src="/icons/wand_24.svg" alt="" className="h-5 w-5" aria-hidden="true" />;
}


function ImageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}
