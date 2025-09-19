// /src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export default function Sidebar({
  compact = false,
  isActive,
  onNotifications,
}: {
  compact?: boolean;
  isActive: (href: string) => boolean;
  onNotifications: () => void;
}) {
  return (
    <div className="text-white h-full overflow-y-auto">
      {/* ===== Logo (sticky, no card/ring/text) ===== */}
      <div
        className="sticky top-0 z-10 pt-2 pb-3"
        style={{ background: "var(--sidebar-bg)" }}
      >
        <Link
          href="/main"
          aria-label="Quizzify home"
          className={compact ? "block mx-auto w-fit" : "block ml-[10px] w-fit"}
        >
          <Image
            src="/logo-q.svg"
            alt="Quizzify"
            width={32}
            height={32}
            priority
            draggable={false}
          />
        </Link>
      </div>

      {/* ===== Group 1 ===== */}
      {!compact && (
        <SectionHeader first className="qz-hide-when-compact">
          Navigation
        </SectionHeader>
      )}
      <nav className="space-y-1.5">
        <SideItem
          href="/main"
          icon={<SvgFileIcon src="/icons/home.svg" className="h-[22px] w-[22px]" />}
          label="Home"
          active={isActive("/main")}
          compact={compact}
        />
        <SideItem
          href="/library"
          icon={<SvgFileIcon src="/icons/library.svg" className="h-[22px] w-[22px]" />}
          label="Library"
          active={isActive("/library")}
          compact={compact}
        />
        <SideItem
          href="/classes"
          icon={<SvgFileIcon src="/icons/classes.svg" className="h-[22px] w-[22px]" />}
          label="Classes"
          active={isActive("/classes")}
          compact={compact}
        />
        <SideItem
          href="/explore"
          icon={<SvgFileIcon src="/icons/explore.svg" className="h-[22px] w-[22px]" />}
          label="Explore"
          active={isActive("/explore")}
          compact={compact}
        />
      </nav>

      <NavDivider />

      {/* ===== Group 2 ===== */}
      {!compact && (
        <SectionHeader className="qz-hide-when-compact">Study</SectionHeader>
      )}
      <nav className="space-y-1.5">
        <SideItem
          href="/learn"
          icon={<SvgFileIcon src="/icons/learn.svg" className="h-[22px] w-[22px]" />}
          label="Learn"
          active={isActive("/learn")}
          compact={compact}
        />
        <SideItem
          href="/flashcards"
          icon={<SvgFileIcon src="/icons/flashcards.svg" className="h-[22px] w-[22px]" />}
          label="Flashcards"
          active={isActive("/flashcards")}
          compact={compact}
        />
        <SideItem
          href="/duels"
          icon={<SvgFileIcon src="/icons/duels.svg" className="h-[22px] w-[22px]" />}
          label="Duels"
          active={isActive("/duels")}
          compact={compact}
        />
      </nav>

      <NavDivider />

      {/* ===== Group 3 ===== */}
      {!compact && (
        <SectionHeader className="qz-hide-when-compact">Social</SectionHeader>
      )}
      <nav className="space-y-1.5 mb-6">
        <SideItem
          href="/friends"
          icon={<SvgFileIcon src="/icons/friends.svg" className="h-[22px] w-[22px]" />}
          label="Friends"
          active={isActive("/friends")}
          compact={compact}
        />
        <SideItemButton
          onClick={onNotifications}
          icon={<SvgFileIcon src="/icons/notifications.svg" className="h-[22px] w-[22px]" />}
          label="Notifications"
          compact={compact}
        />
      </nav>
    </div>
  );
}

/* ========= Local helpers ========= */

function SectionHeader({
  children,
  first = false,
  className = "",
}: {
  children: ReactNode;
  first?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${first ? "mt-3" : "mt-4"} mb-2 px-3 text-sm font-semibold text-white ${className}`}
    >
      {children}
    </div>
  );
}

function NavDivider() {
  return <div className="mx-[6px] my-2 h-px bg-white/15" />;
}

function SideItem({
  href,
  icon,
  label,
  active = false,
  compact = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  compact?: boolean;
}) {
  const base = "group mx-[0px] flex items-center rounded-md overflow-hidden transition-colors";
  const hover = active
    ? "bg-[#24114d] text-white"
    : "text-white hover:bg-white/10 hover:ring-1 hover:ring-white/10";
  const pad = compact ? "p-2 justify-center" : "pl-4 pr-3 py-2 gap-2";

  return (
    <Link
      href={href}
      className={`${base} ${hover} ${pad}`}
      title={compact ? label : undefined}
    >
      <span className="shrink-0 flex h-[22px] w-[22px] items-center justify-center">{icon}</span>
      {!compact && (
        <span className="text-sm font-regular leading-none qz-hide-when-compact">
          {label}
        </span>
      )}
    </Link>
  );
}

function SideItemButton({
  icon,
  label,
  onClick,
  compact = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  const base = "group mx-0 flex rounded-md overflow-hidden text-white transition-colors";
  const pad = compact ? "p-2 justify-center w-full" : "w-[calc(100%-16px)] pl-4 pr-3 py-2 gap-2";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} hover:bg-white/10 hover:ring-1 hover:ring-white/10 ${pad}`}
      title={compact ? label : undefined}
    >
      <span className="shrink-0 flex h-[22px] w-[22px] items-center justify-center">{icon}</span>
      {!compact && (
        <span className="text-sm font-regular leading-none qz-hide-when-compact">
          {label}
        </span>
      )}
    </button>
  );
}

/** Masked SVG so icons inherit currentColor */
function SvgFileIcon({ src, className = "" }: { src: string; className?: string }) {
  const imageUrl = `url(${src})`;
  return (
    <span
      aria-hidden="true"
      className={`block ${className}`}
      style={{
        WebkitMaskImage: imageUrl,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: imageUrl,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        backgroundColor: "currentColor",
      }}
    />
  );
}
