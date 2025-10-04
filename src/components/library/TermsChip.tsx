// /src/components/library/TermsChip.tsx
"use client";

export function TermsChip({ count }: { count: number }) {
  const cls = "bg-white/[0.06] ring-white/10 text-white/80";
  return (
    <span className={["inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1", cls].join(" ")}>
      {count} {count === 1 ? "term" : "terms"}
    </span>
  );
}
