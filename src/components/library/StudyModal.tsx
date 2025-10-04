// /src/components/library/StudyModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function StudyModal({
  open,
  title,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (mode: "learn" | "flashcards" | "duels", opts?: {
    difficulty?: "easy" | "medium" | "hard";
    mute?: boolean;
    scope?: "all" | "recommended";
    shuffle?: boolean;
    untimed?: boolean;
    duelsMode?: "ARENA" | "TEAM" | "STANDARD"; // types kept for forward compatibility
  }) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Steps
  const [step, setStep] = useState<"choose" | "flashcards" | "duels">("choose");

  // Duels mode picker (UI shows only ARENA)
  const [duelsMode] = useState<"ARENA" | "TEAM" | "STANDARD">("ARENA");

  // Flashcards options
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [mute, setMute] = useState<boolean>(false);
  const [scope, setScope] = useState<"all" | "recommended">("all");
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [untimed, setUntimed] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setStep("choose");
      setDifficulty("easy");
      setMute(false);
      setScope("all");
      setShuffle(false);
      setUntimed(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onMouseDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  const Tile = ({ id, label, sub, icon, onClick }: { id: string; label: string; sub: string; icon: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      id={id}
      className={[
        "flex min-h[96px] flex-1 min-w-[160px] rounded-[10px] p-3",
        "flex-col items-center justify-center text-center",
        "ring-1 transition",
        "ring-white/12 hover:bg-white/5",
        "text-white/90 hover:text-white",
      ].join(" ")}
    >
      <img src={icon} alt="" className="h-5 w-5 opacity-90" />
      <div className="mt-1 text-[15px] font-semibold">{label}</div>
      <div className="mt-0.5 text-[12px] text-white/70">{sub}</div>
    </button>
  );

  const DiffRadio = ({ v, label, desc }: { v: "easy" | "medium" | "hard"; label: string; desc: string }) => {
    const active = difficulty === v;
    return (
      <label
        className={[
          "flex items-start gap-3 rounded-[10px] p-3 ring-1 transition cursor-pointer",
          active ? "bg-white/5 ring-white/30" : "ring-white/12 hover:bg-white/5",
          "text-white/90",
        ].join(" ")}
      >
        <input type="radio" name="flash-diff" className="mt-0.5" checked={active} onChange={() => setDifficulty(v)} />
        <div>
          <div className="text-[14px] font-semibold">{label}</div>
          <div className="text-[12px] text-white/70">{desc}</div>
        </div>
      </label>
    );
  };

  return (
    <div className={`fixed inset-0 z-[120] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} role="dialog" aria-modal="true">
      <div className={`absolute inset-0 ${open ? "opacity-100" : "opacity-0"} transition-opacity bg-black/50`} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          ref={wrapRef}
          className={[
            "w-[min(640px,96vw)] rounded-xl",
            "bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl",
            open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
            "transition-all",
          ].join(" ")}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <img src="/icons/wand.svg" alt="" className="h-[16px] w-[16px]" aria-hidden="true" />
                <div className="text-[15px] font-medium">
                  {step === "choose"
                    ? `How do you want to study${title ? `: ${title}` : ""}?`
                    : step === "flashcards"
                    ? "Flashcards • Quick settings"
                    : "Duels • Arena mode"}
                </div>
              </div>
              <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10" aria-label="Close">
                <img src="/icons/close.svg" alt="" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 border-t border-white/10" />

            {step === "choose" ? (
              // No "Learn" tile; just Flashcards and Duels
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Tile id="study-flashcards" label="Flashcards" sub="Classic cards" icon="/icons/flashcards.svg" onClick={() => setStep("flashcards")} />
                <Tile id="study-duels" label="Duels" sub="Arena mode" icon="/icons/duels.svg" onClick={() => setStep("duels")} />
              </div>
            ) : step === "flashcards" ? (
              <div className="mt-3 space-y-3">
                {/* Difficulty radios */}
                <div className="grid gap-2">
                  <DiffRadio v="easy" label="Easy" desc="Gentle pace, more time per card." />
                  <DiffRadio v="medium" label="Medium" desc="Balanced challenge and reinforcement." />
                  <DiffRadio v="hard" label="Hard" desc="Faster pace, stricter timing." />
                </div>

                {/* Scope */}
                <div className="grid sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-3 rounded-[10px] p-3 ring-1 transition cursor-pointer ${scope === "all" ? "bg-white/5 ring-white/30" : "ring-white/12 hover:bg-white/5"} text-white/90`}>
                    <input type="radio" name="scope" className="mt-0.5" checked={scope === "all"} onChange={() => setScope("all")} />
                    <div>
                      <div className="text-[14px] font-semibold">Review all items</div>
                      <div className="text-[12px] text-white/70">Go through the whole set.</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 rounded-[10px] p-3 ring-1 transition cursor-pointer ${scope === "recommended" ? "bg-white/5 ring-white/30" : "ring-white/12 hover:bg-white/5"} text-white/90`}>
                    <input type="radio" name="scope" className="mt-0.5" checked={scope === "recommended"} onChange={() => setScope("recommended")} />
                    <div>
                      <div className="text-[14px] font-semibold">Recommended only</div>
                      <div className="text-[12px] text-white/70">Due now by your mastery schedule.</div>
                    </div>
                  </label>
                </div>

                {/* Toggles */}
                <div className="grid sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#532e95]" />
                    <span>Shuffle</span>
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#532e95]" />
                    <span>Untimed mode</span>
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-white/80 cursor-pointer">
                    <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} className="h-[18px] w-[18px] rounded-[4px] accent-[#532e95]" />
                    <span>Mute music & SFX</span>
                  </label>
                </div>

                {/* Footer actions */}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setStep("choose")} className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick("flashcards", { difficulty, mute, scope, shuffle, untimed })}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors text-sm font-medium",
                    ].join(" ")}
                  >
                    <span className="grid h-[14px] w-[14px] place-items-center">
                      <img src="/icons/flashcards.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
                    </span>
                    <span>Start flashcards</span>
                  </button>
                </div>
              </div>
            ) : (
              // Duels — Only Arena
              <div className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <label
                    className={[
                      "flex items-center justify-between rounded-[10px] p-3 ring-1 transition",
                      "bg-white/5 ring-white/30",
                      "text-white/90",
                    ].join(" ")}
                  >
                    <div>
                      <div className="text-[14px] font-semibold">Arena</div>
                      <div className="text-[12px] text-white/70">Lives + 1v1 pairings, fastest correct wins.</div>
                    </div>
                    <input type="radio" name="duels-mode" checked readOnly />
                  </label>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick("duels", { duelsMode: "ARENA" })}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors text-sm font-medium",
                    ].join(" ")}
                  >
                    <span className="grid h-[14px] w-[14px] place-items-center">
                      <img src="/icons/duels.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />
                    </span>
                    <span>Create lobby</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
