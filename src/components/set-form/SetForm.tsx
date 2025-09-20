// /src/components/set-form/SetForm.tsx
"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import SvgFileIcon from "@/components/SvgFileIcon";

import CardRow from "./CardRow";
import PrivacyMenu from "./PrivacyMenu";
import SkillCombo from "./SkillCombo";
import Progress from "./Progress";
import MergeButton from "@/components/set-form/MergeButton";
import SettingsMenu from "@/components/set-form/SettingsMenu";

import {
  SESSION_KEY,
  AI_MAX_CARDS,
  SOFT_CARD_LIMIT,
  HARD_CARD_LIMIT,
  DEF_MAX,
  INPUT_BASE,
  INPUT_BG,
} from "./constants";

import type { Card, SetFormInitialData, Visibility } from "@/types/set";

type CardUI = Card & {
  _file: File | null;
  _preview: string | null;
  // When null:
  //  - if _explicitNone === true  → explicit "None"
  //  - if _explicitNone === false → inherit default
  skill: string | null;
  _explicitNone?: boolean;
};

/** ---------- helpers to robustly extract skills from many shapes ---------- */
function normStr(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim();
  return v.length ? v : null;
}

/** default skill may arrive as:
 * - data.defaultSkillName: string
 * - data.defaultSkill.name: string
 * - data.defaultSkillLabel: string
 * - data.defaultSkill: string
 */
function extractDefaultSkillName(data: any): string | null {
  return (
    normStr(data?.defaultSkillName) ??
    normStr(data?.defaultSkill?.name) ??
    normStr(data?.defaultSkillLabel) ??
    normStr(data?.defaultSkill) ??
    null
  );
}

/** per-card skill may arrive as:
 * - c.skill: string
 * - c.skillName: string
 * - c.skills[0].skill.name / c.skills[0].name
 * - c.cardSkills[0].skill.name / c.cardSkills[0].name
 * - c.CardSkill[0].skill.name / c.CardSkill[0].name   (defensive aliasing)
 */
function extractCardSkillName(c: any): string | null {
  // flat
  const flat = normStr(c?.skill) ?? normStr(c?.skillName);
  if (flat) return flat;

  // nested arrays to cover common prisma includes
  const arrays = [c?.skills, c?.cardSkills, c?.CardSkill];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) {
      const head = arr[0];
      const nested = normStr(head?.skill?.name) ?? normStr(head?.name);
      if (nested) return nested;
    }
  }
  return null;
}

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

  const [cards, setCards] = useState<CardUI[]>(
    initialData?.cards?.length
      ? initialData.cards.map((c: any) => {
          // Robustly interpret incoming per-card skill state
          const inheritDefault: boolean | undefined = c?.inheritDefault;
          const incomingSkill: string | null = extractCardSkillName(c);

          let skill: string | null = null;
          let _explicitNone = false;

          if (typeof inheritDefault === "boolean") {
            if (inheritDefault) {
              // inherit default
              skill = null;
              _explicitNone = false;
            } else {
              // explicit (could be None or a skill)
              skill = incomingSkill; // string | null
              _explicitNone = incomingSkill == null;
            }
          } else {
            // No inherit flag provided — assume: if skill provided -> explicit, else inherit
            skill = incomingSkill;
            _explicitNone = false;
          }

          return {
            ...c,
            imageUrl: c.imageUrl ?? null,
            _file: null,
            _preview: null,
            skill,
            _explicitNone,
          } as CardUI;
        })
      : [
          { term: "", definition: "", imageUrl: null, _file: null, _preview: null, skill: null, _explicitNone: false },
          { term: "", definition: "", imageUrl: null, _file: null, _preview: null, skill: null, _explicitNone: false },
        ]
  );

  const [isPublic, setIsPublic] = useState<boolean>(initialData?.isPublic ?? false);
  const [saving, setSaving] = useState(false);

  // Default skill for the set (shown in SkillCombo) — seed immediately if present
  const [skill, setSkill] = useState<string | null>(() => extractDefaultSkillName(initialData));

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

    // Seed default set skill from whatever shape arrived
    setSkill(extractDefaultSkillName(initialData));

    // Re-map cards so we preserve explicit vs inherit vs explicit None
    setCards(
      (initialData.cards?.length ? initialData.cards : [{ term: "", definition: "" }]).map((c: any) => {
        const inheritDefault: boolean | undefined = c?.inheritDefault;
        const incomingSkill: string | null = extractCardSkillName(c);

        let skill: string | null = null;
        let _explicitNone = false;

        if (typeof inheritDefault === "boolean") {
          if (inheritDefault) {
            skill = null;
            _explicitNone = false;
          } else {
            skill = incomingSkill;
            _explicitNone = incomingSkill == null;
          }
        } else {
          skill = incomingSkill;
          _explicitNone = false;
        }

        return {
          ...c,
          imageUrl: c.imageUrl ?? null,
          _file: null,
          _preview: null,
          skill,
          _explicitNone,
        } as CardUI;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  /** ---------- manual card helpers with caps ---------- */
  const enforceManualCaps = (nextCards: CardUI[]) => {
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
      const next: CardUI[] = [
        ...c,
        // New cards start as INHERIT (skill=null, _explicitNone=false)
        { term: "", definition: "", imageUrl: null, _file: null, _preview: null, skill: null, _explicitNone: false },
      ];
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

  /** ---------- DnD (handle-only) ---------- */
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
    if (selected.length > 3) alert("You selected more than 3 files. Only the first 3 will be processed.");

    // simple size guard: 25MB each
    const tooBig = files.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) {
      alert(`"${tooBig.name}" is too large. Please upload files under 25MB.`);
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: files.length, label: "Preparing…" });

    try {
      const currentHasContent = cards.some((c) => c.term?.trim() || c.definition?.trim());
      let workingCards: CardUI[] = currentHasContent ? [...cards] : [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress({ current: i, total: files.length, label: `Reading "${f.name}"…` });
        const data = await generateFromSingleFile(f);
        setProgress({ current: i + 0.5, total: files.length, label: `Synthesizing cards from "${f.name}"…` });

        const incoming: CardUI[] =
          (data.cards ?? []).map((c) => ({
            term: String(c.term || ""),
            definition: String(c.definition || "").slice(0, DEF_MAX),
            imageUrl: null,
            _file: null,
            _preview: null,
            // NEW: start as INHERIT (do NOT stamp default)
            skill: null,
            _explicitNone: false,
          })) || [];

        // merge while respecting AI_MAX_CARDS
        const remaining = Math.max(0, AI_MAX_CARDS - workingCards.length);
        if (remaining > 0) {
          workingCards.push(...incoming.slice(0, remaining));
        }

        if (!title && typeof data.title === "string") setTitle(data.title);
        if (!description && typeof data.description === "string") setDescription(data.description);

        setProgress({ current: i + 1, total: files.length, label: `Finished "${f.name}"` });
        if (workingCards.length >= AI_MAX_CARDS) break;
      }

      if (workingCards.length === 0) {
        workingCards = [
          { term: "", definition: "", imageUrl: null, _file: null, _preview: null, skill: null, _explicitNone: false },
        ];
      }
      setCards(workingCards);
    } catch (err: any) {
      alert(err?.message || "Failed to process file.");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  /** ---------- Upload images to Blob ---------- */
  async function uploadFilesAndGetUrls(card: CardUI): Promise<string | null> {
    if (!card._file) return card.imageUrl ?? null;

    const fd = new FormData();
    fd.append("file", card._file);
    fd.append("filename", card._file.name);
    fd.append("prefix", "cards");

    const res = await fetch("/api/blob/upload", { method: "POST", body: fd });
    if (!res.ok) {
      alert("Upload failed");
      return card.imageUrl ?? null;
    }
    const { url } = await res.json();
    return (url as string) || null;
  }

  /** ---------- Submit ---------- */
  const [warnOnNoSkill, setWarnOnNoSkill] = useState(true);
  const [autosave, setAutosave] = useState(false); // NEW: wire to SettingsMenu

  const onSubmit = async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return alert("Please sign in first.");
    const ownerId = JSON.parse(raw)?.id as string | undefined;
    if (!ownerId) return alert("Invalid session.");

    if (!title.trim()) return alert("Please enter a title.");

    // Optional warning if no skill chosen
    if (warnOnNoSkill && !skill) {
      const proceed = confirm("No skill is selected for this set. Continue anyway?");
      if (!proceed) return;
    }

    // Upload any new files first and collect URLs — INCLUDE position + tri-state mapping
    const finalized = await Promise.all(
      cards.map(async (c, i) => {
        let imageUrl = c.imageUrl ?? null;
        if (c._file) imageUrl = await uploadFilesAndGetUrls(c);

        // Tri-state serialization:
        // - INHERIT:            omit 'skill' (skill===null && !_explicitNone)
        // - EXPLICIT NONE:      skill: null   (skill===null && _explicitNone===true)
        // - EXPLICIT "Some":    skill: "Some" (skill is string)
        const base: any = {
          term: c.term.trim(),
          definition: c.definition.trim().slice(0, DEF_MAX),
          imageUrl,
          position: i,
        };

        if (c.skill === null) {
          if (c._explicitNone) {
            base.skill = null; // explicit None
          }
          // else inherit → omit 'skill'
        } else {
          base.skill = c.skill; // explicit skill
        }

        return base;
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
            ownerId, // required
            title: title.trim(),
            description: description.trim() || null,
            isPublic,
            defaultSkill: skill ?? null, // persist default skill
            cards: cleanCards, // includes tri-state fields
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
            ownerId, // so the route can upsert UserSkill on edit
            title: title.trim(),
            description: description.trim() || null,
            isPublic,
            defaultSkill: skill ?? null, // persist default skill
            cards: cleanCards, // includes tri-state fields
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

  /** ---------- Merge (stub) ---------- */
  const handleMerge = () => {
    alert("Merge coming soon");
  };

  /** ---------- Privacy dropdown state ---------- */
  const [visibility, setVisibility] = useState<Visibility>("public");
  const handleVisibilityChange = (v: Visibility) => {
    setVisibility(v);
    if (v === "public") setIsPublic(true);
    if (v === "private") setIsPublic(false);
  };

  /** ---------- Set default skill (does NOT stamp per-item) ---------- */
  const handleDefaultSkillChange = (next: string | null) => {
    // IMPORTANT: do NOT mutate per-item skills here.
    // Keeping card.skill === null means the card INHERITS the default at save time.
    setSkill(next);
  };

  if (mode === "edit" && !initialData) {
    return null; // or a tiny skeleton/spinner if you prefer
  }

  return (
    <section className="mx-auto max-w-5xl">
      {/* Top row: title + CTA */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] sm:text-[16px] md:text-[18px] font-medium leading-tight text-[#f0f6fc]">
          {mode === "create" ? "Create a new study set" : "Edit Study Set"}
        </h1>
        <div className="flex items-center gap-3">
          {/* Settings before Privacy */}
          <SettingsMenu
            warnOnNoSkill={warnOnNoSkill}
            autosave={autosave}
            onChangeWarn={setWarnOnNoSkill}
            onChangeAutosave={setAutosave}
          />
          <PrivacyMenu value={visibility} onChange={handleVisibilityChange} />

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || generating}
            aria-busy={saving || generating}
            className={[
              "inline-flex items-center gap-1.5 rounded-[6px]",
              "h-8 px-2.5",
              "text-white/90 hover:text-white",
              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
              "ring-1 ring-white/20 hover:ring-white/10",
              "transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {saving || generating ? (
              <svg className="h-[14px] w-[14px] animate-spin text-white/80" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
              </svg>
            ) : (
              <SvgFileIcon src="/icons/add.svg" className="h-[14px] w-[14px]" />
            )}
            <span className="text-sm font-medium">
              {saving ? (mode === "create" ? "Creating..." : "Saving...") : mode === "create" ? "Create set" : "Save changes"}
            </span>
          </button>
        </div>
      </div>

      {/* Title / Description */}
      <div className="mt-3 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className={[INPUT_BASE, "h-11 px-3 text-[15px]"].join(" ")}
          style={{ backgroundColor: INPUT_BG }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={4}
          className={[
            INPUT_BASE,
            "h-[88px] overflow-auto qz-scroll px-3 text-[15px] leading-[1.25] py-2 resize-none",
          ].join(" ")}
          style={{ backgroundColor: INPUT_BG }}
        />
      </div>

      {/* Toolbar (AI + Skill) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAIUploadClick}
            disabled={generating}
            className={[
              "inline-flex items-center gap-1.5 rounded-[6px]",
              "h-8 px-2.5",
              "text-white/90 hover:text-white",
              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
              "ring-1 ring-white/20 hover:ring-white/10",
              "transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            <span className="grid h-[14px] w-[14px] place-items-center">
              <img src="/icons/wand.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">{generating ? "Analyzing…" : "Generate from AI"}</span>
          </button>

          {/* Merge button */}
          <MergeButton onClick={handleMerge} disabled={generating} />

          <input
            ref={aiFileRef}
            type="file"
            accept=".pdf,.docx,.pptx"
            multiple
            className="hidden"
            onChange={handleAIFileChange}
          />
        </div>

        <div className="flex items-center gap-5">
          <SkillCombo value={skill} onChange={handleDefaultSkillChange} />
        </div>
      </div>

      {/* Divider after the toolbar */}
      <div className="mt-3 border-t border-white/10" />

      {/* Cards */}
      <div className="mt-4 space-y-4">
        {cards.map((card, i) => (
          <div
            key={`${card.id ?? i}:${card.skill ?? "null"}`}
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
              skill={card.skill}
              // If this card is explicit None, we want "None" in the chip; otherwise show set default
              defaultSkillLabel={card._explicitNone ? "None" : (skill ?? "None")}
              previewUrl={card._preview || card.imageUrl || null}
              onChangeTerm={updateCardField(i, "term")}
              onChangeDefinition={updateCardField(i, "definition")}
              onChangeSkill={(v) =>
                setCards((prev) => {
                  const next = [...prev];
                  // v === null can be EXPLICIT NONE (user chose "None")
                  // if user picks a real skill, clear explicit None flag
                  next[i] = { ...next[i], skill: v, _explicitNone: v === null ? true : false };
                  return next;
                })
              }
              onPickImage={onPickImage(i)}
              onClearImage={onClearImage(i)}
              onRemove={() => removeCard(i)}
              onHandleDragStart={onHandleDragStart(i)}
            />
          </div>
        ))}
      </div>

      {/* Divider before "Add a card" */}
      <div className="mt-6 border-t border-white/10" />

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={addCard}
          className="rounded-full px-5 py-2 text-sm text-white/90 ring-1 ring-white/20 hover:bg-white/10"
        >
          Add a card
        </button>
      </div>

      {/* Full-screen loading overlay */}
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

      {/* Minimal dark scrollbar */}
      <style jsx global>{`
        .qz-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
        }
        .qz-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .qz-scroll::-webkit-scrollbar-track { background: transparent; }
        .qz-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 9999px; }
        .qz-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.28); }
      `}</style>
    </section>
  );
}
