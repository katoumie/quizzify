"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, useMemo } from "react";
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

/** Wrap pages with the shared header + sidebar; right slide-over comes from <NotificationsPanel/> */
export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // user display (from your local session)
  const [firstName, setFirstName] = useState("User");
  const [initial, setInitial] = useState("U");
  const [email, setEmail] = useState<string>("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileHref, setProfileHref] = useState<string>("/u/me"); // NEW

  // profile dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // CREATE dropdown
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement | null>(null);
  const createBtnRef = useRef<HTMLButtonElement | null>(null);

  // sidebar states
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ---- session bootstrap + live refresh ----
  useEffect(() => {
    const extractAvatarSrc = (avatar: Avatar): string | null => {
      if (!avatar) return null;
      if (typeof avatar === "string") return avatar; // supports string shape
      if (typeof avatar === "object" && "src" in avatar) {
        return (avatar as AvatarObj).src;
      }
      return null;
    };

    const refreshFromStorage = () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
          router.replace("/signin");
          return;
        }
        const session = JSON.parse(raw) as SessionUser | null;
        if (!session?.id) {
          router.replace("/signin");
          return;
        }

        const em = session.email ?? "";
        const display = session.username?.trim()
          ? session.username.trim()
          : deriveFirstName(em);

        setFirstName(display);
        setInitial(display.charAt(0).toUpperCase() || "U");
        setEmail(em);
        setAvatarSrc(extractAvatarSrc(session.avatar));

        // NEW: build /u/[handle] — prefer username, fallback to user id
        const handle = (session.username?.trim() || session.id).trim();
        setProfileHref(`/u/${encodeURIComponent(handle)}`);
      } catch {
        router.replace("/signin");
      }
    };

    refreshFromStorage();

    // Cross-tab updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) refreshFromStorage();
    };
    // Same-tab updates (Settings emits "qz:session-updated" after Save/Reset)
    const onCustom = () => refreshFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("qz:session-updated", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("qz:session-updated", onCustom);
    };
  }, [router]);

  // close profile dropdown on outside/Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuOpen) return;
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
        setCreateOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // close CREATE dropdown on outside/Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!createOpen) return;
      const t = e.target as Node;
      if (createRef.current?.contains(t) || createBtnRef.current?.contains(t)) return;
      setCreateOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [createOpen]);

  const handleHamburger = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileOpen((v) => !v);
    } else {
      setDesktopCollapsed((v) => !v);
    }
  };

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

  // ===== THEME: match signin page (Perpetual vs Default) =====
  const isPerpetual = useMemo(() => email.toLowerCase().endsWith("@perpetual.edu.ph"), [email]);

  return (
    <div className={`${isPerpetual ? "theme-perpetual" : "theme-default"} min-h-screen`} style={{ background: "var(--bg)" }}>
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-[100] w-full" style={{ background: "var(--bg)" }}>
        <div className="h-[72px] px-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          {/* Left cluster: hamburger + logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle menu"
              aria-controls="app-sidebar"
              aria-expanded={!desktopCollapsed}
              onClick={handleHamburger}
              className="h-10 w-10 grid place-items-center rounded-lg hover:bg-white/10 text-white"
            >
              <SvgFileIcon src="/icons/menu_24.svg" className="h-6 w-6" />
            </button>

            <Link href="/main" aria-label="Quizzify home" className="font-[var(--font-inter)] text-[28px] leading-none select-none no-underline">
              <span className="font-bold" style={{ color: "var(--brand)" }}>
                Quizz
              </span>
              <span className="font-bold text-white">ify</span>
            </Link>
          </div>

          {/* Center search */}
          <form action="/search" className="hidden md:block justify-self-center w-full max-w-3xl">
            <label htmlFor="site-search" className="sr-only">
              Search
            </label>
            <div className="relative group">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70 group-focus-within:text-white" />
              <input
                id="site-search"
                name="q"
                type="search"
                placeholder="Flashcard sets, textbooks, questions"
                autoComplete="off"
                className="w-full h-11 rounded-xl text-white placeholder-white/80 pl-10 pr-4 text-sm ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              />
            </div>
          </form>

          {/* Right cluster: Create + Profile */}
          <div className="flex items-center gap-3">
            {/* Create dropdown trigger */}
            <div className="relative">
              <button
                ref={createBtnRef}
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={createOpen}
                aria-label="Open create menu"
                className="h-9 w-9 grid place-items-center rounded-full text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
                style={{ backgroundColor: "var(--brand)" }}
              >
                <SvgFileIcon src="/icons/add_24.svg" className="h-4 w-4" />
              </button>

              {/* Create dropdown */}
              <div
                ref={createRef}
                role="menu"
                aria-label="Create menu"
                className={`absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/60 shadow-lg transition ${
                  createOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                }`}
                style={{ background: "var(--bg)" }}
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

            {/* Profile dropdown trigger — avatar-first */}
            <div className="relative">
              <button
                ref={btnRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Open user menu for ${firstName}`}
                className="h-9 w-9 grid place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Your avatar" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-white/10 grid place-items-center text-white/90 font-semibold">
                    {initial}
                  </div>
                )}
              </button>

              {/* User menu */}
              <div
                ref={menuRef}
                role="menu"
                aria-label="User menu"
                className={`absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-white/60 shadow-lg transition ${
                  menuOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                }`}
                style={{ background: "var(--bg)" }}
              >
                {/* Header */}
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
                    <div className="truncate text-sm font-semibold text-white">{firstName}</div>
                    <div className="truncate text-xs text-white">{email}</div>
                  </div>
                </div>

                <div className="border-t border-white/60" />

                {/* Section 1 */}
                <div className="py-1">
                  {/* Uses computed /u/[handle] */}
                  <MenuRow href={profileHref} iconSrc="/icons/profile_24.svg" label="Profile" />
                  <MenuRow href="/achievements" iconSrc="/icons/trophy_24.svg" label="Achievements" />
                  <MenuRow href="/settings" iconSrc="/icons/settings_24.svg" label="Settings" />
                </div>

                <div className="border-t border-white/60" />

                {/* Section 2 */}
                <div className="py-1">
                  <MenuRow asButton onClick={handleLogout} iconSrc="/icons/logout_24.svg" label="Log out" danger />
                </div>

                <div className="border-t border-white/60" />

                {/* Section 3 */}
                <div className="py-1">
                  <MenuRow href="/help" iconSrc="/icons/help_24.svg" label="Help and feedback" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== Mobile sidebar overlay (md:hidden) ===== */}
      <div className={`md:hidden fixed inset-0 z-40 ${mobileOpen ? "" : "pointer-events-none"}`}>
        {/* scrim */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileOpen(false)}
        />
        {/* panel */}
        <aside
          className={`absolute inset-y-0 left-0 w-72 px-3 pb-3 pt-4 transform transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "var(--bg)" }}
        >
          <SidebarExpanded isActive={isActive} onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))} />
        </aside>
      </div>

      {/* ===== Desktop layout: fixed left rail + content to the right ===== */}
      <div className="hidden md:block">
        <aside
          id="app-sidebar"
          className={`fixed left-0 top-[72px] z-30 h-[calc(100vh-72px)] px-2 pt-2 transition-[width,transform] duration-300 ease-out ${
            desktopCollapsed ? "w-[72px]" : "w-[260px]"
          }`}
          style={{ background: "var(--bg)" }}
        >
          {desktopCollapsed ? (
            <SidebarCollapsed isActive={isActive} onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))} />
          ) : (
            <SidebarExpanded isActive={isActive} onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))} />
          )}
        </aside>

        {/* Content column clears the rail width */}
        <main className={`${desktopCollapsed ? "md:pl-[72px]" : "md:pl-[260px]"} px-4 py-6 transition-[padding] duration-300`}>
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>

      {/* ===== Notifications slide-over ===== */}
      <NotificationsPanel />

      {/* Theme tokens (same as signin) */}
      <style jsx global>{`
        :root {
          --bg: #0a092d;
          --brand: #4262ff;
          --hover-bg: rgba(255, 255, 255, 0.08);
          --bg-card: rgba(255, 255, 255, 0.05);
          --btn-contrast: #ffffff;
        }
        .theme-perpetual {
          --bg: #2a0b0b;
          --brand: #f8cd00;
          --hover-bg: rgba(248, 205, 0, 0.12);
          --bg-card: rgba(255, 255, 255, 0.06);
          --btn-contrast: #000000;
        }
        .theme-default {
          --bg: #0a092d;
          --brand: #4262ff;
          --hover-bg: rgba(255, 255, 255, 0.08);
          --bg-card: rgba(255, 255, 255, 0.05);
          --btn-contrast: #ffffff;
        }
      `}</style>
    </div>
  );
}

/* ========= Reusable parts ========= */

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
        <SideItemButton onClick={onNotifications} icon={<SvgFileIcon src="/icons/notifications_24.svg" className="h-5 w-5" />} label="Notifications" badge="1" />
      </nav>

      <hr className="my-3 border-white/10" />
      <div className="px-3 text-xs uppercase tracking-wide text-white/50 mb-2">Your folders</div>
      <SideItemButton icon={<SvgFileIcon src="/icons/add_24.svg" className="h-4 w-4" />} label="New folder" onClick={() => {}} />
    </div>
  );
}

/* ---- Sidebar (collapsed icon-only rail) ---- */
function SidebarCollapsed({
  isActive,
  onNotifications,
}: {
  isActive: (href: string) => boolean;
  onNotifications: () => void;
}) {
  return (
    <div className="w-[72px] py-3 flex flex-col items-center text-white">
      <div className="mb-2" />
      <IconItem href="/main" active={isActive("/main")} tooltip="Home">
        <SvgFileIcon src="/icons/home_24.svg" className="h-5 w-5" />
      </IconItem>
      <IconItem href="/library" active={isActive("/library")} tooltip="Library">
        <SvgFileIcon src="/icons/folder_icon.svg" className="h-5 w-5" />
      </IconItem>
      <IconItem href="/learn" active={isActive("/learn")} tooltip="Learn">
        <SvgFileIcon src="/icons/learn_24.svg" className="h-5 w-5" />
      </IconItem>
      <IconItem href="/flashcards" active={isActive("/flashcards")} tooltip="Flashcards">
        <SvgFileIcon src="/icons/flashcards_24.svg" className="h-5 w-5" />
      </IconItem>
      <IconItem href="/explore" active={isActive("/explore")} tooltip="Explore">
        <SvgFileIcon src="/icons/search_24.svg" className="h-5 w-5" />
      </IconItem>
      <IconItemButton onClick={onNotifications} tooltip="Notifications" badge>
        <SvgFileIcon src="/icons/notifications_24.svg" className="h-5 w-5" />
      </IconItemButton>

      <Divider />
      <IconItem href="#" tooltip="New folder">
        <SvgFileIcon src="/icons/add_24.svg" className="h-5 w-5" />
      </IconItem>
    </div>
  );
}

/* Collapsed icon helper (link) */
function IconItem({
  href,
  children,
  active = false,
  tooltip,
  badge = false,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
  tooltip?: string;
  badge?: boolean;
}) {
  return (
    <Link href={href} className="relative my-1" aria-label={tooltip} title={tooltip}>
      <div
        className={`h-10 w-10 grid place-items-center rounded-xl transition ${
          active ? "bg-[var(--brand)]/10 ring-2 ring-[var(--brand)]/30 text-[var(--brand)]" : "hover:bg-white/10 hover:ring-1 hover:ring-white/10 text-white/90"
        }`}
      >
        <span className="block">{children}</span>
      </div>
      {badge && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] px-1 justify-center items-center">
          1
        </span>
      )}
    </Link>
  );
}

/* Collapsed icon helper (button) */
function IconItemButton({
  children,
  tooltip,
  badge = false,
  onClick,
}: {
  children: ReactNode;
  tooltip?: string;
  badge?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="relative my-1" aria-label={tooltip} title={tooltip}>
      <div className="h-10 w-10 grid place-items-center rounded-xl transition hover:bg-white/10 hover:ring-1 hover:ring-white/10 text-white/90">
        <span className="block">{children}</span>
      </div>
      {badge && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] px-1 justify-center items-center">
          1
        </span>
      )}
    </button>
  );
}

function Divider() {
  return <div className="my-3 h-px w-10 bg-white/10" />;
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
        active ? "bg-[var(--brand)]/10 ring-2 ring-[var(--brand)]/30 text-[var(--brand)]" : "hover:bg-white/10 hover:ring-1 hover:ring-white/10 text-white/90"
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

/* ========== File-based SVG icon (tints via currentColor) ========== */
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

/* ====== Tiny inline icons kept for header UI ====== */
function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`block ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`block ${className}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
