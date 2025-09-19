// /src/components/SubnavLibrary.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Alignment constants — keep in sync with layout */
const SIDEBAR_W = 240;       // sidebar width
const CONTENT_GAP = 20;      // pl-[260px] => 240 + 20
const EXTRA_PUSH = 16;       // your extra push
const NAVBAR_XPAD = 16;      // navbar px-4
const LEFT_OFFSET = SIDEBAR_W + CONTENT_GAP + EXTRA_PUSH - NAVBAR_XPAD; // 260

/** Keep tabs from colliding with the right cluster (search/profile) */
const RIGHT_SAFE = 380;

/** Highlight geometry */
const HILIGHT_H = 3;         // thickness in px
const HILIGHT_OVERRUN = 6;   // left/right overshoot (px)
const HILIGHT_OFFSET = 9;    // distance below label (px)

export default function SubnavLibrary() {
  const search = useSearchParams();
  const active = (search.get("tab") || "sets") as "sets" | "notes" | "folders";

  const tabs = [
    { key: "sets", label: "Study sets" },
    { key: "notes", label: "Magic notes" },
    { key: "folders", label: "Folders" },
  ] as const;

  return (
    <div
      className="absolute inset-y-0 flex items-end"
      style={{ left: LEFT_OFFSET, right: RIGHT_SAFE }}
    >
      <nav className="h-full pb-[10px] flex items-end gap-6 text-sm text-white/80">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={`/library?tab=${t.key}`}
              className={[
                "relative block leading-none no-underline",
                "hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded",
                "font-semibold",         // ⬅️ semibold tabs
                isActive ? "text-white" : "",
              ].join(" ")}
              style={{ paddingTop: 6, paddingBottom: 4 }}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 rounded-full bg-[#a8b1ff]"  // ⬅️ highlight color
                  style={{
                    height: `${HILIGHT_H}px`,
                    left: `-${HILIGHT_OVERRUN}px`,
                    right: `-${HILIGHT_OVERRUN}px`,
                    bottom: `-${HILIGHT_OFFSET}px`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
