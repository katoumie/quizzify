// /src/components/library/LikesPill.tsx
"use client";

export function LikesPill({ count }: { count: number }) {
  const cls = "bg-white/[0.06] ring-white/10 text-white/80";
  return (
    <span className={["inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ring-1", cls].join(" ")}>
      <img src="/icons/like.svg" alt="" className="h-[12px] w-[12px]" />
      {count}
    </span>
  );
}
