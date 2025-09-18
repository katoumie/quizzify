// /src/components/AppShell.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import NotificationsPanel from "@/components/NotificationsPanel";

const SESSION_KEY = "qz_auth";
const SIDEBAR_W = 240;         // fixed sidebar width
const OVERLAY_GAP = 12;        // small gap after 240px (and on the right side too)

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
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const [searchTop, setSearchTop] = useState<number>(0);

  function computeTopFromWrap() {
    const wrap = searchWrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    return Math.round(rect.top);
  }

  function openOverlayFromCompact_NoAnim() {
    setSearchTop(computeTopFromWrap());
    setSearchOpen(true);
    requestAnimationFrame(() => {
      expandedRef.current?.focus();
      expandedRef.current?.select();
    });
  }

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

  // close menus on outside/Esc (and collapse search-on-click)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuOpen && !(menuRef.current?.contains(t) || btnRef.current?.contains(t))) setMenuOpen(false);
      if (createOpen && !(createRef.current?.contains(t) || createBtnRef.current?.contains(t))) setCreateOpen(false);
      if (searchOpen && !searchWrapRef.current?.contains(t)) setSearchOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setCreateOpen(false);
        setSearchOpen(false);
        return;
      }

      // Press "/" to focus search unless typing in a field
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tgt = e.target as HTMLElement | null;
        const typing =
          !!tgt &&
          (tgt.tagName === "INPUT" ||
            tgt.tagName === "TEXTAREA" ||
            (tgt as HTMLElement).isContentEditable);

        if (!typing) {
          e.preventDefault();
          if (!searchOpen) {
            openOverlayFromCompact_NoAnim();
          } else {
            requestAnimationFrame(() => {
              expandedRef.current?.focus();
              expandedRef.current?.select();
            });
          }
        }
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, createOpen, searchOpen]);

  // keep the stretching search anchored while open
  useEffect(() => {
    if (!searchOpen) return;
    const onWinChange = () => {
      setSearchTop(computeTopFromWrap());
    };
    window.addEventListener("resize", onWinChange);
    window.addEventListener("scroll", onWinChange, { passive: true });
    const t = setTimeout(onWinChange, 50);
    return () => {
      window.removeEventListener("resize", onWinChange);
      window.removeEventListener("scroll", onWinChange);
      clearTimeout(t);
    };
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

  const onSetStatus = () => {
    // TODO: open a "Set status" sheet/modal
    console.log("Open Set Status modal");
    setMenuOpen(false);
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
            <Link href="/main" aria-label="Quizzify home" className="flex items-center gap-3 no-underline">
              <Image
                src="/logo-q.svg"
                alt="Quizzify"
                width={24}
                height={24}
                className="rounded-full ring-1 ring-white/10"
              />
              <span className="text-[13px] md:text-sm font-semibold text-white">
                {pageTitle}
              </span>
            </Link>
          </div>

          {/* Right cluster: Search + Create + Profile */}
          <div className="flex items-center gap-3">
            {/* Compact search that stretches left when focused */}
            <form
              className="w-[260px] hidden md:block"
              onSubmit={(e) => { if (!q.trim()) e.preventDefault(); }}
            >
              <label htmlFor="site-search" className="sr-only">Search</label>

              {/* Wrapper becomes fixed while searchOpen === true */}
              <div
                ref={searchWrapRef}
                className={[
                  "group",
                  searchOpen ? "fixed z-[60]" : "relative",
                ].join(" ")}
                style={
                  searchOpen
                    ? { left: SIDEBAR_W + OVERLAY_GAP, right: OVERLAY_GAP, top: searchTop }
                    : undefined
                }
                onFocus={() => {
                  if (!searchOpen) openOverlayFromCompact_NoAnim();
                }}
              >
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70 group-focus-within:text-white" />
                <input
                  ref={(el) => {
                    compactRef.current = el;
                    expandedRef.current = el; // bind both for smooth focus/selection
                  }}
                  id="site-search"
                  name="q"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Type / to search"
                  autoComplete="off"
                  className={[
                    "no-native-clear",
                    "w-full h-8 rounded-md text-white placeholder-white/60 pl-8 pr-8 text-[13px]",
                    "ring-1 ring-white/12",
                    // Focused border color -> #180733
                    "group-focus-within:ring-[#a8b1ff]",
                    // subtle inner top highlight
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                    "focus:outline-none",
                  ].join(" ")}
                  style={{ backgroundColor: "#18062e" }}
                />
                {/* Keycap "/" when empty and not expanded */}
                {!q && !searchOpen && (
                  <kbd
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-6 min-w-[22px] px-1 grid place-items-center rounded-[6px] text-[11px] text-white/80 ring-1 ring-white/12"
                    style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                  >
                    /
                  </kbd>
                )}
                {/* Custom clear */}
                {q && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => {
                      setQ("");
                      compactRef.current?.focus();
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-4 w-4 rounded-full ring-1 ring-white/20 hover:ring-white/30"
                    style={{ backgroundColor: "#8a8f98" }}
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                      <path d="M2 2 L10 10 M10 2 L2 10" stroke="#18062e" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </form>

            {/* Create button — keycap style (plus + caret) */}
            <div className="relative">
              <button
                ref={createBtnRef}
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                aria-label="Open create menu"
                className={[
                  "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[6px]",
                  "text-white/90 hover:text-white",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                  "ring-1 ring-white/12 hover:ring-white/20",
                ].join(" ")}
                style={{ backgroundColor: "#18062e" }}
              >
                <SvgFileIcon src="/icons/add_24.svg" className="h-[14px] w-[14px]" />
                <CaretDownIcon className="h-3.5 w-3.5 text-white/80" />
              </button>

              {/* Create dropdown */}
              <div
                ref={createRef}
                role="menu"
                aria-label="Create menu"
                className={`absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border border-white/15 bg=[var(--bg)] shadow-lg transition ${
                  createOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                }`}
              >
                <div className="p-2">
                  <Link
                    href="/create"
                    role="menuitem"
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-regular text-white hover:bg-white/10"
                    onClick={() => setCreateOpen(false)}
                  >
                    <SvgFileIcon src="/icons/add_24.svg" className="h-[18px] w-[18px] text-white" />
                    <span>Create set</span>
                  </Link>
                  <button
                    role="menuitem"
                    onClick={onCreateFolder}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-regular text-white hover:bg-white/10 text-left"
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
                  menuOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                }`}
              >
                {/* Header */}
                <MenuHeader avatarSrc={avatarSrc} initial={initial} firstName={firstName} email={email} />

                {/* Set status */}
                <MenuRow asButton onClick={onSetStatus} iconSrc="/icons/status_24.svg" label="Set status" />

                <div className="mx-2 my-2 h-px bg-white/15" />

                {/* Profile + Achievements */}
                <div className="py-1">
                  <MenuRow href={profileHref} iconSrc="/icons/profile_24.svg" label="Profile" />
                  <MenuRow href="/achievements" iconSrc="/icons/trophy_24.svg" label="Achievements" />
                </div>

                <div className="mx-2 my-2 h-px bg-white/15" />

                {/* Settings + Help */}
                <div className="py-1">
                  <MenuRow href="/settings" iconSrc="/icons/settings_24.svg" label="Settings" />
                  <MenuRow href="/help" iconSrc="/icons/help_24.svg" label="Help and feedback" />
                </div>

                <div className="mx-2 my-2 h-px bg-white/15" />

                {/* Sign out */}
                <div className="py-1">
                  <MenuRow
                    asButton
                    onClick={handleLogout}
                    iconSrc="/icons/logout_24.svg"
                    label="Sign out"
                    danger
                    className="mb-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Layout: sidebar always visible ===== */}
      <aside
        id="app-sidebar"
        className="fixed left-0 top-[61px] z-30 h-[calc(109vh-70px)] w-[240px] px-2 pt-2 border-r border-white/15"
        style={{ background: "var(--sidebar-bg)" }}
      >
        <SidebarExpanded
          isActive={(href) => isActive(href)}
          onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))}
        />
      </aside>

      <main className="pl-[260px] px-4 py-6 transition-[padding] duration-300">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      <NotificationsPanel />

      {/* Hide native "x" on type=search (keep only our custom clear) */}
      <style jsx global>{`
        input.no-native-clear::-webkit-search-cancel-button {
          -webkit-appearance: none;
          appearance: none;
          display: none;
        }
        input.no-native-clear::-webkit-search-decoration {
          -webkit-appearance: none;
        }
        input.no-native-clear::-ms-clear {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
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
        <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-white/10 grid place-items-center text-white font-regular">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{firstName}</div>
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

  // Row spans full width; content nudged right with pl-4 (keep highlight width unchanged).
  const base =
    "relative w-full flex items-center gap-2 pl-4 pr-3 py-2 text-sm rounded-md text-left transition";

  const text = danger ? "text-red-300" : "text-white";

  // Inset hover stays aligned with your dividers (both ends = mx-2)
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

function deriveFirstName(email: string): string {
  const beforeAt = (email ?? "").split("@")[0] || "user";
  const token = beforeAt.split(/[._-]/)[0] || "user";
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function SidebarExpanded({
  isActive,
  onNotifications,
}: {
  isActive: (href: string) => boolean;
  onNotifications: () => void;
}) {
  return (
    <div className="text-white">
      <nav className="space-y-1.5">
        <SideItem href="/main" icon={<SvgFileIcon src="/icons/home_24.svg" className="h-5 w-5" />} label="Home" active={isActive("/main")} />
        <SideItem href="/library" icon={<SvgFileIcon src="/icons/folder_icon.svg" className="h-5 w-5" />} label="Library" active={isActive("/library")} />
        <SideItem href="/learn" icon={<SvgFileIcon src="/icons/learn_24.svg" className="h-5 w-5" />} label="Learn" active={isActive("/learn")} />
        <SideItem href="/flashcards" icon={<SvgFileIcon src="/icons/flashcards_24.svg" className="h-5 w-5" />} label="Flashcards" active={isActive("/flashcards")} />
        <SideItem href="/explore" icon={<SvgFileIcon src="/icons/search_24.svg" className="h-5 w-5" />} label="Explore" active={isActive("/explore")} />
        <SideItemButton onClick={onNotifications} icon={<SvgFileIcon src="/icons/notifications_24.svg" className="h-5 w-5" />} label="Notifications" />
      </nav>
      <div className="mx-2 my-2 h-px bg-white/15" />
      <div className="px-3 text-xs uppercase tracking-wide text-white/50 mb-2">Your folders</div>
      <SideItemButton icon={<SvgFileIcon src="/icons/add_24.svg" className="h-4 w-4" />} label="New folder" onClick={() => {}} />
    </div>
  );
}

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
      className={`group w-full flex items-center gap-2 pl-4 pr-3 py-2 rounded-md overflow-hidden ${
        active
          ? "bg-[#24114d] text-white"
          : "text-white hover:bg-white/10 hover:ring-1 hover:ring-white/10"
      }`}
    >
      <span className="shrink-0 flex h-[18px] w-[18px] items-center justify-center">{icon}</span>
      <span className="text-sm font-regular leading-none">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex h-5 min-w-[20px] rounded-full bg-red-500 text-[11px] px-1 justify-center items-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

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
      className="group w-full flex items-center gap-2 pl-4 pr-3 py-2 rounded-md overflow-hidden text-white hover:bg-white/10 hover:ring-1 hover:ring-white/10"
    >
      <span className="shrink-0 flex h-[18px] w-[18px] items-center justify-center">{icon}</span>
      <span className="text-sm font-regular leading-none">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex h-5 min-w-[20px] rounded-full bg-red-500 text-[11px] px-1 justify-center items-center">
          {badge}
        </span>
      )}
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

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`block ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

function CaretDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`block ${className}`} fill="currentColor" aria-hidden="true">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}
