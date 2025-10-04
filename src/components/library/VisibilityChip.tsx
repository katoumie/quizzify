// /src/components/library/VisibilityChip.tsx
"use client";

export function VisibilityChip({ isPublic, visibility }: { isPublic: boolean; visibility?: string }) {
  const label = isPublic ? "Public" : visibility === "friends" ? "Friends" : "Private";
  const cls = "bg-white/[0.06] ring-white/10 text-white/80";
  return (
    <span className={["inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1", cls].join(" ")}>
      {label}
    </span>
  );
}
