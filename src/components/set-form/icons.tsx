// /src/components/set-form/icons.tsx
"use client";

import SvgFileIcon from "@/components/SvgFileIcon";

export function DragHandleIcon() {
  return <SvgFileIcon src="/icons/drag_handle.svg" className="h-5 w-5" />;
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" />
    </svg>
  );
}

export function ImageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}

export function AIIcon() {
  return <img src="/icons/wand.svg" alt="" className="h-[14px] w-[14px] block" aria-hidden="true" />;
}
