// /src/components/SubnavClass.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Keep in sync with your layout values */
const SIDEBAR_W = 240;       // sidebar width
const CONTENT_GAP = 20;      // pl-[260px] => 240 + 20
const EXTRA_PUSH = 16;       // extra nudge to align under page title
const NAVBAR_XPAD = 16;      // navbar px-4
const LEFT_OFFSET = SIDEBAR_W + CONTENT_GAP + EXTRA_PUSH - NAVBAR_XPAD; // 260

/** To avoid colliding with search/profile cluster */
const RIGHT_SAFE = 380;

/** Highlight geometry */
const HILIGHT_H = 3;
const HILIGHT_OVERRUN = 6;
const HILIGHT_OFFSET = 9;

const ICON_SIZE = 18;
const ICONS = {
  sets: "/icons/study_sets.svg",
  members: "/icons/friends.svg",
} as const;

export default function SubnavClass({ id }: { id: string }) {
  const search = useSearchParams();
  const active = (search.get("tab") || "sets") as "sets" | "members";

  const tabs = [
    { key: "sets", label: "Study sets" },
    { key: "members", label: "Members" },
  ] as const;

  return (
    <div
      // IMPORTANT: let clicks pass through outside of the nav itself
      className="pointer-events-none absolute inset-y-0 flex items-end z-[5]"
      style={{ left: "calc(var(--sidebar-w) + 20px - 16px + 16px)", right: RIGHT_SAFE }}
      aria-hidden={false}
    >
      <nav
        className="pointer-events-auto h-full pb-[10px] flex items-end gap-6 text-sm text-white/80"
        aria-label="Class tabs"
      >
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={`/classes/${id}?tab=${t.key}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative inline-flex items-center gap-2 leading-none no-underline rounded",
                "hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                "font-semibold",
                isActive ? "text-white" : "",
              ].join(" ")}
              style={{ paddingTop: 6, paddingBottom: 4 }}
            >
              <SvgIcon src={ICONS[t.key]} size={ICON_SIZE} />
              <span>{t.label}</span>

              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 rounded-full"
                  style={{
                    backgroundColor: "#a8b1ff",
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

/** Masked SVG so icons inherit currentColor */
function SvgIcon({ src, size }: { src: string; size: number }) {
  const imageUrl = `url(${src})`;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        WebkitMaskImage: imageUrl,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: imageUrl,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        backgroundColor: "currentColor",
        display: "inline-block",
      }}
    />
  );
}
