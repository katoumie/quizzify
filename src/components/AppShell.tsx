// /src/components/AppShell.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import NotificationsPanel from "@/components/NotificationsPanel";

const SESSION_KEY = "qz_auth";

type AvatarObj = { kind: "builtin" | "upload"; src: string };
type Avatar = string | AvatarObj | null | undefined;

type SessionUser = {
  id: string;
  email: string;
  username?: string | null;
  createdAt?: string;
  avatar?: Avatar;
};

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // session display
  const [firstName, setFirstName] = useState("User");
  const [initial, setInitial] = useState("U");
  const [email, setEmail] = useState<string>("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileHref, setProfileHref] = useState<string>("/u/me");

  // profile dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // CREATE dropdown
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement | null>(null);
  const createBtnRef = useRef<HTMLButtonElement | null>(null);

  // Search
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const expandedRef = useRef<HTMLInputElement | null>(null);
  const compactRef = useRef<HTMLInputElement | null>(null);

  // session bootstrap
  useEffect(() => {
    const extractAvatarSrc = (avatar: Avatar): string | null => {
      if (!avatar) return null;
      if (typeof avatar === "string") return avatar;
      if (typeof avatar === "object" && "src" in avatar) return (avatar as AvatarObj).src;
      return null;
    };

    const refreshFromStorage = () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return router.replace("/signin");
        const session = JSON.parse(raw) as SessionUser | null;
        if (!session?.id) return router.replace("/signin");
        const em = session.email ?? "";
        const display = session.username?.trim() ? session.username.trim() : deriveFirstName(em);
        setFirstName(display);
        setInitial(display.charAt(0).toUpperCase() || "U");
        setEmail(em);
        setAvatarSrc(extractAvatarSrc(session.avatar));
        const handle = (session.username?.trim() || session.id).trim();
        setProfileHref(`/u/${encodeURIComponent(handle)}`);
      } catch {
        router.replace("/signin");
      }
    };

    refreshFromStorage();
    const onStorage = (e: StorageEvent) => e.key === SESSION_KEY && refreshFromStorage();
    const onCustom = () => refreshFromStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener("qz:session-updated", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("qz:session-updated", onCustom);
    };
  }, [router]);

  // close menus on outside/Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuOpen && !(menuRef.current?.contains(t) || btnRef.current?.contains(t))) setMenuOpen(false);
      if (createOpen && !(createRef.current?.contains(t) || createBtnRef.current?.contains(t))) setCreateOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setCreateOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, createOpen]);

  // "/" hotkey: open expanded search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        !!target &&
        ((target as HTMLElement).isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
      if (isEditable) return;
      e.preventDefault();
      setSearchOpen(true);
      // focus expanded after paint
      setTimeout(() => {
        expandedRef.current?.focus();
        expandedRef.current?.select();
      }, 0);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // focus expanded on open if triggered by click/focus
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => expandedRef.current?.focus(), 0);
    }
  }, [searchOpen]);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    router.replace("/signin");
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/main" && pathname?.startsWith(href));

  const onCreateFolder = () => {
    console.log("Create folder clicked");
    setCreateOpen(false);
  };

  const pageTitle = useMemo(() => {
    if (!pathname) return "";
    if (pathname.startsWith("/main")) return "Dashboard";
    if (pathname.startsWith("/library")) return "Library";
    if (pathname.startsWith("/learn")) return "Learn";
    if (pathname.startsWith("/flashcards")) return "Flashcards";
    if (pathname.startsWith("/explore")) return "Explore";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/achievements")) return "Achievements";
    if (pathname.startsWith("/u/")) return "Profile";
    const seg = pathname.split("/").filter(Boolean).pop() || "";
    return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "";
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      {/* ===== Sticky Navbar (60px) ===== */}
      <div className="sticky top-0 z-50 w-full border-b border-white/15" style={{ backgroundColor: "#18062e" }}>
        <div className="h-[60px] px-4 flex items-center justify-between gap-3">
          {/* Left cluster: logo + page title */}
          <div className="flex items-center gap-3">
            <Link href="/main" aria-label="Quizzify home" className="flex items-center gap-4 no-underline">
              <Image
                src="/logo-q.png"
                alt="Quizzify"
                width={32}
                height={32}
                className="rounded-full ring-1 ring-white/10"
              />
              <span className="text-sm md:text-base font-semibold text-white/80">
                {pageTitle}
              </span>
            </Link>
          </div>

          {/* Right cluster: Search + Create + Profile */}
          <div className="flex items-center gap-3">
            {/* Compact search (smaller height, inner focus ring, custom clear) */}
            <form
              action="/search"
              className="hidden md:block w-[320px]"
              onSubmit={(e) => {
                if (!q.trim()) e.preventDefault();
              }}
            >
              <label htmlFor="site-search" className="sr-only">Search</label>
              <div
                className="relative group"
                onFocus={() => setSearchOpen(true)}
              >
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 group-focus-within:text-white" />
                <input
                  ref={compactRef}
                  id="site-search"
                  name="q"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Type / to search"
                  autoComplete="off"
                  className={[
                    "w-full h-9 rounded-xl text-white placeholder-white/70 pl-9 pr-9 text-sm",
                    "ring-1 ring-white/10",                   // subtle outer line (idle)
                    "focus:outline-none focus:ring-1",        // remove outer glow/offset
                    "focus:ring-white/0",                     // kill outer ring color
                    "focus:[box-shadow:inset_0_0_0_2px_rgba(160,167,189,0.45)]", // inner faint gray ring
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                  ].join(" ")}
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                />
                {/* Clear button (shows only when there's a query) */}
                {q && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => {
                      setQ("");
                      compactRef.current?.focus();
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded-full ring-1 ring-white/15 hover:brightness-110"
                    style={{ backgroundColor: "rgba(160,167,189,0.35)" }}
                  >
                    <SvgFileIcon src="/icons/cancel_24.svg" className="h-3.5 w-3.5 text-white/90" />
                  </button>
                )}
                {/* Shortcut hint when empty */}
                {!q && (
                  <kbd
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-6 min-w-[22px] px-1 grid place-items-center rounded-md text-[11px] text-white/80 ring-1 ring-white/15"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  >
                    /
                  </kbd>
                )}
              </div>
            </form>

            {/* Create dropdown trigger */}
            <div className="relative">
              <button
                ref={createBtnRef}
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                aria-label="Open create menu"
                className="h-8 w-8 grid place-items-center rounded-full hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                style={{ backgroundColor: "#4262ff" }}
              >
                <SvgFileIcon src="/icons/add_24.svg" className="h-[14px] w-[14px]" />
              </button>

              {/* Create dropdown */}
              <div
                ref={createRef}
                role="menu"
                aria-label="Create menu"
                className={`absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg)] shadow-lg transition ${
                  createOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                }`}
              >
                <div className="p-2">
                  <Link
                    href="/create"
                    role="menuitem"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
                    onClick={() => setCreateOpen(false)}
                  >
                    <SvgFileIcon src="/icons/add_24.svg" className="h-[18px] w-[18px] text-white" />
                    <span>Create set</span>
                  </Link>
                  <button
                    role="menuitem"
                    onClick={onCreateFolder}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 text-left"
                  >
                    <SvgFileIcon src="/icons/folder_icon.svg" className="h-[18px] w-[18px] text-white" />
                    <span>Create folder</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Profile dropdown trigger */}
            <div className="relative">
              <button
                ref={btnRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Open user menu for ${firstName}`}
                className="h-8 w-8 grid place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Your avatar" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center text-white/90 text-sm font-semibold">
                    {initial}
                  </div>
                )}
              </button>

              {/* User menu */}
              <div
                ref={menuRef}
                role="menu"
                aria-label="User menu"
                className={`absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg)] shadow-lg transition ${
                  menuOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                }`}
              >
                <MenuHeader avatarSrc={avatarSrc} initial={initial} firstName={firstName} email={email} />
                <div className="border-t border-white/10" />
                <div className="py-1">
                  <MenuRow href={profileHref} iconSrc="/icons/profile_24.svg" label="Profile" />
                  <MenuRow href="/achievements" iconSrc="/icons/trophy_24.svg" label="Achievements" />
                  <MenuRow href="/settings" iconSrc="/icons/settings_24.svg" label="Settings" />
                </div>
                <div className="border-t border-white/10" />
                <div className="py-1">
                  <MenuRow asButton onClick={handleLogout} iconSrc="/icons/logout_24.svg" label="Log out" danger />
                </div>
                <div className="border-t border-white/10" />
                <div className="py-1">
                  <MenuRow href="/help" iconSrc="/icons/help_24.svg" label="Help and feedback" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Desktop layout: fixed left rail + content to the right ===== */}
      <div className="hidden md:block">
        <aside
          id="app-sidebar"
          className="fixed left-0 top-[61px] z-30 h-[calc(109vh-70px)] w-[260px] px-2 pt-2 border-r border-white/15"
          style={{ background: "var(--sidebar-bg)" }}
        >
          <SidebarExpanded
            isActive={(href) => isActive(href)}
            onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))}
          />
        </aside>

        <main className="md:pl-[260px] px-4 py-6 transition-[padding] duration-300">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>

      {/* ===== Expanded search overlay (card + dim/blur) ===== */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60]">
          {/* Scrim with mild blur */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setSearchOpen(false)}
          />
          {/* Floating search card (extends to the left) */}
          <div
            className="absolute left-3 right-3 md:left-3 md:right-3 top-2"
          >
            <div className="mx-auto max-w-[1600px] rounded-2xl border border-white/15 shadow-2xl"
                 style={{ background: "var(--bg)" }}>
              <div className="p-3 md:p-4">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                  <input
                    ref={expandedRef}
                    id="site-search-expanded"
                    name="q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search sets, folders, questions…"
                    className={[
                      "w-full h-12 rounded-xl text-white placeholder-white/70 pl-10 pr-10 text-[15px]",
                      "ring-1 ring-white/10",
                      "focus:outline-none focus:ring-1 focus:ring-white/0",
                      "focus:[box-shadow:inset_0_0_0_2px_rgba(160,167,189,0.45)]",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                    ].join(" ")}
                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    autoFocus
                  />
                  {q && (
                    <button
                      type="button"
                      aria-label="Clear"
                      onClick={() => {
                        setQ("");
                        expandedRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full ring-1 ring-white/15 hover:brightness-110"
                      style={{ backgroundColor: "rgba(160,167,189,0.35)" }}
                    >
                      <SvgFileIcon src="/icons/cancel_24.svg" className="h-4 w-4 text-white/90" />
                    </button>
                  )}
                </div>
                {/* Results area placeholder (optional) */}
                {/* <div className="mt-3 text-white/70 text-sm">Recent searches…</div> */}
              </div>
            </div>
          </div>
        </div>
      )}

      <NotificationsPanel />
    </div>
  );
}

/* ========= Reusable parts ========= */

function MenuHeader({
  avatarSrc, initial, firstName, email,
}: { avatarSrc: string | null; initial: string; firstName: string; email: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarSrc} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-white/10 grid place-items-center text-white/90 font-semibold">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{firstName}</div>
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
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  iconSrc: string;
  asButton?: boolean;
  danger?: boolean;
}) {
  const base = "flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition";
  const colors = danger ? "text-red-300 hover:bg-red-500/10" : "text-white hover:bg-white/10";
  const content = (
    <>
      <SvgFileIcon src={iconSrc} className="h-[18px] w-[18px] text-white" />
      <span>{label}</span>
    </>
  );
  if (asButton || !href) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${colors} w-full text-left`}>
        {content}
      </button>
    );
  }
  return (
    <Link href={href} className={`${base} ${colors}`}>
      {content}
    </Link>
  );
}

function deriveFirstName(email: string): string {
  if (!email) return "User";
  const beforeAt = email.split("@")[0] || "user";
  const token = beforeAt.split(/[._-]/)[0] || "user";
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/* ---- Sidebar (expanded) ---- */
function SidebarExpanded({
  isActive,
  onNotifications,
}: {
  isActive: (href: string) => boolean;
  onNotifications: () => void;
}) {
  return (
    <div className="text-white pr-3">
      <nav className="space-y-2">
        <SideItem href="/main" icon={<SvgFileIcon src="/icons/home_24.svg" className="h-5 w-5" />} label="Home" active={isActive("/main")} />
        <SideItem href="/library" icon={<SvgFileIcon src="/icons/folder_icon.svg" className="h-5 w-5" />} label="Library" active={isActive("/library")} />
        <SideItem href="/learn" icon={<SvgFileIcon src="/icons/learn_24.svg" className="h-5 w-5" />} label="Learn" active={isActive("/learn")} />
        <SideItem href="/flashcards" icon={<SvgFileIcon src="/icons/flashcards_24.svg" className="h-5 w-5" />} label="Flashcards" active={isActive("/flashcards")} />
        <SideItem href="/explore" icon={<SvgFileIcon src="/icons/search_24.svg" className="h-5 w-5" />} label="Explore" active={isActive("/explore")} />
        <SideItemButton onClick={onNotifications} icon={<SvgFileIcon src="/icons/notifications_24.svg" className="h-5 w-5" />} label="Notifications" />
      </nav>

      <hr className="my-3 border-white/10" />
      <div className="px-3 text-xs uppercase tracking-wide text-white/50 mb-2">Your folders</div>
      <SideItemButton icon={<SvgFileIcon src="/icons/add_24.svg" className="h-4 w-4" />} label="New folder" onClick={() => {}} />
    </div>
  );
}

/* Expanded side item (link) */
function SideItem({
  href,
  icon,
  label,
  active = false,
  badge,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 h-9 px-3 rounded-lg ${
        active
          ? "bg-[#2a1a63] text-[#a8b1ff]"
          : "hover:bg-white/10 hover:ring-1 hover:ring-white/10 text-white/90"
      }`}
    >
      <span className="shrink-0 flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="text-sm font-semibold leading-none">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex h-5 min-w-[20px] rounded-full bg-red-500 text-[11px] px-1 justify-center items-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

/* Expanded side item (button) */
function SideItemButton({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 h-9 px-3 rounded-lg hover:bg-white/10 hover:ring-1 hover:ring-white/10 text-white/90"
    >
      <span className="shrink-0 flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="text-sm font-semibold leading-none">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex h-5 min-w-[20px] rounded-full bg-red-500 text-[11px] px-1 justify-center items-center">
          {badge}
        </span>
      )}
    </button>
  );
}

/* Masked SVG icon helper (tints via currentColor) */
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

/* Small inline search icon */
function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`block ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
