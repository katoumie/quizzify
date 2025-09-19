// /src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export default function Sidebar({
  isActive,
  onNotifications,
}: {
  isActive: (href: string) => boolean;
  onNotifications: () => void;
}) {
  return (
    <div className="text-white">
      {/* Group 1 */}
      <SectionHeader first>Navigation</SectionHeader>
      <nav className="space-y-1.5">
        <SideItem
          href="/main"
          icon={<SvgFileIcon src="/icons/home.svg" className="h-5 w-5" />}
          label="Home"
          active={isActive("/main")}
        />
        <SideItem
          href="/library"
          icon={<SvgFileIcon src="/icons/library.svg" className="h-5 w-5" />}
          label="Library"
          active={isActive("/library")}
        />
        <SideItem
          href="/classes"
          icon={<SvgFileIcon src="/icons/classes.svg" className="h-5 w-5" />}
          label="Classes"
          active={isActive("/classes")}
        />
        <SideItem
          href="/explore"
          icon={<SvgFileIcon src="/icons/explore.svg" className="h-5 w-5" />}
          label="Explore"
          active={isActive("/explore")}
        />
      </nav>

      <NavDivider />

      {/* Group 2 */}
      <SectionHeader>Study</SectionHeader>
      <nav className="space-y-1.5">
        <SideItem
          href="/learn"
          icon={<SvgFileIcon src="/icons/learn.svg" className="h-5 w-5" />}
          label="Learn"
          active={isActive("/learn")}
        />
        <SideItem
          href="/flashcards"
          icon={<SvgFileIcon src="/icons/flashcards.svg" className="h-5 w-5" />}
          label="Flashcards"
          active={isActive("/flashcards")}
        />
        <SideItem
          href="/duels"
          icon={<SvgFileIcon src="/icons/duels.svg" className="h-5 w-5" />}
          label="Duels"
          active={isActive("/duels")}
        />
      </nav>

      <NavDivider />

      {/* Group 3 */}
      <SectionHeader>Social</SectionHeader>
      <nav className="space-y-1.5">
        <SideItem
          href="/friends"
          icon={<SvgFileIcon src="/icons/friends.svg" className="h-5 w-5" />}
          label="Friends"
          active={isActive("/friends")}
        />
        <SideItemButton
          onClick={onNotifications}
          icon={<SvgFileIcon src="/icons/notifications.svg" className="h-5 w-5" />}
          label="Notifications"
        />
      </nav>
    </div>
  );
}

/* ========= Local helpers ========= */

function SectionHeader({
  children,
  first = false,
}: {
  children: ReactNode;
  first?: boolean;
}) {
  // First subtext pushed down; white, semibold, not all caps
  return (
    <div className={`${first ? "mt-3" : "mt-4"} mb-2 px-3 text-sm font-semibold text-white`}>
      {children}
    </div>
  );
}

function NavDivider() {
  // 6px inset + top/bottom padding similar to profile menu
  return <div className="mx-[6px] my-2 h-px bg-white/15" />;
}

function SideItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group mx-[0px] flex items-center gap-2 pl-4 pr-3 py-2 rounded-md overflow-hidden ${
        active
          ? "bg-[#24114d] text-white"
          : "text-white hover:bg-white/10 hover:ring-1 hover:ring-white/10"
      }`}
    >
      <span className="shrink-0 flex h-[18px] w-[18px] items-center justify-center">{icon}</span>
      <span className="text-sm font-regular leading-none">{label}</span>
    </Link>
  );
}

function SideItemButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mx-0 flex w-[calc(100%-16px)] items-center gap-2 pl-4 pr-3 py-2 rounded-md overflow-hidden text-white hover:bg-white/10 hover:ring-1 hover:ring-white/10"
    >
      <span className="shrink-0 flex h-[18px] w-[18px] items-center justify-center">{icon}</span>
      <span className="text-sm font-regular leading-none">{label}</span>
    </button>
  );
}

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
