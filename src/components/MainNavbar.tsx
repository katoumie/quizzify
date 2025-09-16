"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "qz_auth";

export default function MainNavbar() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("User");
  const [initial, setInitial] = useState("U");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      const email: string | undefined = session?.email;
      const name = deriveFirstName(email ?? "");
      setFirstName(name);
      setInitial(name.charAt(0).toUpperCase() || "U");
      setAvatarUrl(session?.avatarUrl || null); // later: store avatarUrl in session
    } catch {/* no-op */}
  }, []);

  // Close on outside click or Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
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

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    // optional: toast/confirmation later
    router.replace("/signin");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#121024]/95 backdrop-blur supports-[backdrop-filter]:bg-[#121024]/80 border-b border-white/5">
      <div className="container mx-auto h-[80px] px-4 flex items-center justify-between">
        {/* Logo → /main */}
        <Link
          href="/main"
          aria-label="Quizzify home"
          className="font-[var(--font-inter)] text-[30px] leading-none select-none no-underline"
        >
          <span className="font-bold text-[#4262ff]">Quizz</span>
          <span className="font-normal text-white">ify</span>
        </Link>

        {/* Profile button → dropdown */}
        <div className="relative">
          <button
            ref={btnRef}
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="group inline-flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4262ff]"
          >
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${firstName} avatar`}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/10 grid place-items-center text-white/80 font-semibold">
                {initial}
              </div>
            )}
            {/* Name (hide on very small screens) */}
            <span className="hidden sm:inline text-sm font-medium text-white">
              {firstName}
            </span>
            {/* Chevron */}
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 text-white/70 transition ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>

          {/* Dropdown menu */}
          <div
            ref={menuRef}
            role="menu"
            aria-label="User menu"
            className={`absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-white/5 bg-[#0b0e14]/95 backdrop-blur shadow-lg transition
              ${open ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"}`}
          >
            <Link
              href="/profile"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function deriveFirstName(email: string): string {
  if (!email) return "User";
  const beforeAt = email.split("@")[0] || "user";
  const token = beforeAt.split(/[._-]/)[0] || "user";
  return token.charAt(0).toUpperCase() + token.slice(1);
}
