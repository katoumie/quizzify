// /src/components/set-form/CardRow.tsx
"use client";

import { useEffect, useRef } from "react";
import { DEF_MAX } from "./constants";
import { DragHandleIcon, ImageIcon } from "./icons"; // TrashIcon removed
import SvgFileIcon from "@/components/SvgFileIcon";
import MiniSkillCombo from "./MiniSkillCombo";

const TERM_MAX = DEF_MAX; // 500

export default function CardRow({
  index,
  term,
  definition,
  skill,
  defaultSkillLabel,
  previewUrl,
  onChangeTerm,
  onChangeDefinition,
  onChangeSkill,
  onPickImage,
  onClearImage,
  onRemove,
  onHandleDragStart,
}: {
  index: number;
  term: string;
  definition: string;
  skill: string | null;
  defaultSkillLabel: string;
  previewUrl: string | null;
  onChangeTerm: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChangeDefinition: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChangeSkill: (v: string | null) => void;
  onPickImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  onRemove: () => void;
  onHandleDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear any legacy inline heights so fixed h-32 can apply
  const termRef = useRef<HTMLTextAreaElement | null>(null);
  const defRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (termRef.current) termRef.current.style.height = "";
    if (defRef.current) defRef.current.style.height = "";
  }, []);

  const termLen = term.length;
  const defLen = definition.length;

  const BASE_AREA = [
    "h-32 w-full resize-none overflow-auto qz-scroll rounded-lg",
    "bg-[var(--bg)] px-3 text-white text-[15px] placeholder-white/70",
    "ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]",
    "leading-[1.25] py-3",
  ].join(" ");

  return (
    <>
      {/* Row header */}
      <div className="flex items-center justify-between px-4 py-1 text-white/90">
        {/* Left: Mini per-item skill */}
        <div className="flex items-center gap-2 mt-2">
          <MiniSkillCombo value={skill} defaultLabel={defaultSkillLabel} onChange={onChangeSkill} />
        </div>

        {/* Right: Delete • Drag • # */}
        <div className="flex items-center gap-2 mt-2">
          {/* Delete */}
          <button
            type="button"
            onClick={onRemove}
            className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:text-white hover:bg-white/10"
            title="Delete card"
            aria-label="Delete card"
          >
            <SvgFileIcon src="/icons/delete.svg" className="h-4.5 w-4.5" />
          </button>

          {/* Drag (handle-only) */}
          <button
            type="button"
            draggable
            onDragStart={onHandleDragStart}
            className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/10 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            aria-label="Drag to reorder"
            tabIndex={0}
          >
            <DragHandleIcon />
          </button>

          {/* Card number (rightmost) */}
          <div className="min-w-[22px] text-right font-semibold tabular-nums">{index + 1}</div>
        </div>
      </div>


      {/* Inputs + Right-side Image box */}
      <div className="grid grid-cols-1 gap-2 px-4 pb-3 md:grid-cols-[1fr_1fr_128px] md:items-start">
        {/* Term */}
        <div className="relative mt-1.5">  {/* ⟵ added mt-1.5 (≈6px) */}
          <span className="absolute right-2 -top-5 text-[11px] text-white/60 px-1 py-0.5 rounded text-right">
            Term
          </span>

          <textarea
            ref={termRef}
            value={term}
            onChange={onChangeTerm}
            placeholder=""
            rows={3}
            maxLength={TERM_MAX}
            className={BASE_AREA}
          />

          {termLen > 0 && (
            <div className="mt-1 flex justify-end">
              <span className="text-[11px] text-white/60 tabular-nums">
                {termLen}/{TERM_MAX}
              </span>
            </div>
          )}
        </div>

        {/* Definition */}
        <div className="relative mt-1.5"> {/* ⟵ added mt-1.5 (≈6px) */}
          <span className="absolute right-2 -top-5 text-[11px] text-white/60 px-1 py-0.5 rounded text-right">
            Definition
          </span>

          <textarea
            ref={defRef}
            value={definition}
            onChange={onChangeDefinition}
            placeholder=""
            rows={3}
            maxLength={DEF_MAX}
            className={BASE_AREA}
          />

          {defLen > 0 && (
            <div className="mt-1 flex justify-end">
              <span className="text-[11px] text-white/60 tabular-nums">
                {defLen}/{DEF_MAX}
              </span>
            </div>
          )}
        </div>

        {/* Right-side image picker / preview (128px square) */}
        <div className="md:ml-2 mt-1.5">
          <div
            className="group relative grid h-32 w-full place-items-center rounded-lg ring-1 ring-dashed ring-white/30 bg-white/5 overflow-hidden"
            title="Add image"
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 hidden items-center justify-center bg-black/50 p-2 group-hover:flex">
                  <button
                    type="button"
                    onClick={onClearImage}
                    title="Remove image"
                    aria-label="Remove image"
                    className={[
                      "grid h-9 w-9 place-items-center rounded-full",
                      "text-white/90",
                      "bg-white/10 backdrop-blur-sm",
                      "ring-1 ring-white/15",
                      "hover:bg-white/15 hover:ring-white/10",
                      "active:bg-white/10",
                      "transition-colors"
                    ].join(" ")}
                  >
                    <SvgFileIcon src="/icons/delete.svg" className="h-4 w-4" />
                  </button>
                </div>

              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-white/70 hover:bg-white/5"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-[11px]">Image</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>
      </div>

      {/* Minimal dark scrollbar (kept here for self-containment) */}
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
    </>
  );
}
