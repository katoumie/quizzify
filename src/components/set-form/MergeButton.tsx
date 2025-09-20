"use client";

import SvgFileIcon from "@/components/SvgFileIcon";

export default function MergeButton({
  onClick,
  disabled,
}: {
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-1.5 rounded-[6px]",
        "h-8 px-2.5",
        "text-white/90 hover:text-white",
        // base, hover (slightly brighter), and active (slightly darker)
        "bg-[#1f8b4c] hover:bg-[#23a45a] active:bg-[#1b7a45]",
        "ring-1 ring-white/20 hover:ring-white/10",
        "transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      ].join(" ")}
    >
      <SvgFileIcon src="/icons/merge.svg" className="h-4 w-4" />
      <span className="text-sm font-medium">Merge</span>
    </button>
  );
}
