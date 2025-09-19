// /src/components/ProfileMenu.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SvgFileIcon from "@/components/SvgFileIcon";

export default function ProfileMenu({
  avatarSrc,
  initial,
  displayName,
  email,
  profileHref,
  onSetStatus,
  onLogout,
}: {
  avatarSrc: string | null;
  initial: string;
  displayName: string;
  email: string;
  profileHref: string;
  onSetStatus: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && !(menuRef.current?.contains(t) || btnRef.current?.contains(t))) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open user menu for ${displayName}`}
        className="h-8 w-8 grid place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="Your avatar" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center text-white text-sm font-semibold">
            {initial}
          </div>
        )}
      </button>

      {/* User menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="User menu"
        className={`absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-white/15 bg-[var(--bg)] shadow-lg transition ${
          open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <MenuHeader avatarSrc={avatarSrc} initial={initial} displayName={displayName} email={email} />

        {/* Set status */}
        <MenuRow asButton onClick={() => { onSetStatus(); setOpen(false); }} iconSrc="/icons/status_24.svg" label="Set status" />

        <div className="mx-2 my-2 h-px bg-white/15" />

        {/* Profile + Achievements */}
        <div className="py-1">
          <MenuRow href={profileHref} iconSrc="/icons/profile_24.svg" label="Profile" onClick={() => setOpen(false)} />
          <MenuRow href="/achievements" iconSrc="/icons/trophy_24.svg" label="Achievements" onClick={() => setOpen(false)} />
        </div>

        <div className="mx-2 my-2 h-px bg-white/15" />

        {/* Settings + Help */}
        <div className="py-1">
          <MenuRow href="/settings" iconSrc="/icons/settings_24.svg" label="Settings" onClick={() => setOpen(false)} />
          <MenuRow href="/help" iconSrc="/icons/help_24.svg" label="Help and feedback" onClick={() => setOpen(false)} />
        </div>

        <div className="mx-2 my-2 h-px bg-white/15" />

        {/* Sign out */}
        <div className="py-1">
          <MenuRow
            asButton
            onClick={() => { onLogout(); setOpen(false); }}
            iconSrc="/icons/logout_24.svg"
            label="Sign out"
            danger
            className="mb-2"
          />
        </div>
      </div>
    </div>
  );
}

/* ===== Internals ===== */

function MenuHeader({
  avatarSrc, initial, displayName, email,
}: { avatarSrc: string | null; initial: string; displayName: string; email: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center text-white font-regular">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{displayName}</div>
        <div className="truncate text-xs">{email}</div>
      </div>
    </div>
  );
}

function MenuRow({
  href,
  onClick,
  label,
  iconSrc,
  asButton = false,
  danger = false,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  iconSrc: string;
  asButton?: boolean;
  danger?: boolean;
  className?: string;
}) {
  const Comp: any = asButton || !href ? "button" : Link;

  const base =
    "relative w-full flex items-center gap-2 pl-4 pr-3 py-2 text-sm rounded-md text-left transition";
  const text = danger ? "text-red-300" : "text-white";
  const insetHover =
    'before:content-[""] before:absolute before:inset-y-0 before:left-2 before:right-2 before:rounded-md before:pointer-events-none ' +
    (danger
      ? "hover:before:bg-red-500/10 focus-visible:before:bg-red-500/10"
      : "hover:before:bg-white/10 focus-visible:before:bg-white/10");

  return (
    <Comp
      {...(href ? { href } : {})}
      type={asButton ? "button" : undefined}
      onClick={onClick}
      className={`${base} ${text} ${insetHover} ${className}`}
    >
      <SvgFileIcon src={iconSrc} className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </Comp>
  );
}
