// /src/components/AppShell.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import NotificationsPanel from "@/components/NotificationsPanel";
import Sidebar from "@/components/Sidebar";
import NavSearch from "@/components/NavSearch";
import CreateMenu from "@/components/CreateMenu";
import ProfileMenu from "@/components/ProfileMenu";
import SubnavLibrary from "@/components/SubnavLibrary";
import SubnavClass from "@/components/SubnavClass"; // ⬅️ NEW
import SvgFileIcon from "@/components/SvgFileIcon";

const SESSION_KEY = "qz_auth";
const SIDEBAR_COMPACT_KEY = "qz_sidebar_compact";

// Layout metrics
const NAV_H = 60;
const HEADER_BORDER = 1;
const SIDEBAR_W = 240;
const SIDEBAR_W_COMPACT = 72;
const CONTENT_GAP = 20;

type AvatarObj = { kind: "builtin" | "upload"; src: string };
type Avatar = string | AvatarObj | null | undefined;
type SessionUser = { id: string; email: string; username?: string | null; createdAt?: string; avatar?: Avatar };

export default function AppShell({
  children,
  initialCompact = false,
}: {
  children: React.ReactNode;
  initialCompact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // ===== Session display =====
  const [displayName, setDisplayName] = useState("User");
  const [initial, setInitial] = useState("U");
  const [email, setEmail] = useState<string>("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileHref, setProfileHref] = useState<string>("/u/me");

  // ===== Sidebar compact state (now seeded from server via prop) =====
  const [sidebarCompact, setSidebarCompact] = useState<boolean>(initialCompact);

  function setSidebarCompactDOM(next: boolean) {
    const w = next ? SIDEBAR_W_COMPACT : SIDEBAR_W;
    document.documentElement.dataset.sidebarCompact = next ? "1" : "0";
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    setSidebarCompact(next);
  }

  // On first mount, sync DOM and localStorage to the server-provided value
  useLayoutEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COMPACT_KEY, initialCompact ? "1" : "0");
    } catch {}
    setSidebarCompactDOM(initialCompact);

    // Cross-tab + BFCache listeners
    const onPageShow = () => {
      try {
        const compact = localStorage.getItem(SIDEBAR_COMPACT_KEY) === "1";
        setSidebarCompactDOM(compact);
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_COMPACT_KEY) {
        const compact = e.newValue === "1";
        setSidebarCompactDOM(compact);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // === Toggle writes cookie + localStorage so SSR matches on next request
  const toggleSidebarCompact = () => {
    const next = !sidebarCompact;
    try {
      localStorage.setItem(SIDEBAR_COMPACT_KEY, next ? "1" : "0");
    } catch {}
    document.cookie = `qz_sidebar_compact=${next ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setSidebarCompactDOM(next);
  };

  // ===== Session bootstrap =====
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
        const derived = session.username?.trim() ? session.username.trim() : deriveDisplayFromEmail(em);

        setDisplayName(derived);
        setInitial(derived.charAt(0).toUpperCase() || "U");
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

  const handleLogout = () => {
    try {
      localStorage.removeItem(SIDEBAR_COMPACT_KEY);
    } catch {}
    document.cookie = `qz_sidebar_compact=0; Path=/; Max-Age=0; SameSite=Lax`;
    setSidebarCompactDOM(false);
    localStorage.removeItem(SESSION_KEY);
    router.replace("/signin");
  };

  const isActive = (href: string) => pathname === href || (href !== "/main" && pathname?.startsWith(href));
  const onSetStatus = () => console.log("Open Set Status modal");

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

  const showLibraryTabs = pathname?.startsWith("/library") ?? false;
  // ⬇️ NEW: show SubnavClass for /classes/[id] pages
  const showClassTabs = pathname?.startsWith("/classes/") ?? false;
  const classId = showClassTabs ? (pathname?.split("/")[2] || "") : "";

  const sidebarTopPx = NAV_H + HEADER_BORDER;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      {/* ===== Single Sticky Navbar ===== */}
      <div className="sticky top-0 z-50 w-full border-b border-white/15" style={{ backgroundColor: "#18062e" }}>
        <div className="relative h-[60px] px-4 flex items-center justify-between gap-3">
          {/* Left: hamburger only (logo moved into Sidebar) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={sidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={sidebarCompact}
              onClick={toggleSidebarCompact}
              className={[
                "h-8 px-2.5 inline-flex items-center justify-center rounded-[6px]",
                "text-white/90 hover:text-white",
                "bg-[#18062e]",
                "ring-1 ring-white/12 hover:bg-white/10 hover:ring-white/10",
                "transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
              ].join(" ")}
              title={sidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
            >
              <SvgFileIcon src="/icons/menu.svg" className="h-[14px] w-[14px]" />
            </button>
          </div>

          {/* Center: subnavs */}
          {showLibraryTabs ? <SubnavLibrary /> : showClassTabs ? <SubnavClass id={classId} /> : null}

          {/* Right: Search + Create + Profile */}
          <div className="flex items-center gap-3">
            <NavSearch />
            <CreateMenu />
            <ProfileMenu
              avatarSrc={avatarSrc}
              initial={initial}
              displayName={displayName}
              email={email}
              profileHref={profileHref}
              onSetStatus={onSetStatus}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>

      {/* ===== Sidebar with logo at top ===== */}
      <aside
        id="app-sidebar"
        className="fixed left-0 z-30 px-2 pt-2 border-r border-white/15"
        style={{
          background: "var(--sidebar-bg)",
          top: sidebarTopPx,
          width: "var(--sidebar-w)",
          height: `calc(100vh - ${sidebarTopPx}px)`,
        }}
      >
        <Sidebar
          compact={sidebarCompact}
          isActive={(href) => isActive(href)}
          onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))}
        />
      </aside>

      {/* ===== Main ===== */}
      <main
        className="px-4 py-6 transition-[padding] duration-300"
        style={{ paddingLeft: `calc(var(--sidebar-w) + ${CONTENT_GAP}px)` }}
      >
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      <NotificationsPanel />

      {/* Hide native "x" on type=search (keep only our custom clear) */}
      <style jsx global>{`
        input.no-native-clear::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
        input.no-native-clear::-webkit-search-decoration { -webkit-appearance: none; }
        input.no-native-clear::-ms-clear { display: none; width: 0; height: 0; }
      `}</style>
    </div>
  );
}

function deriveDisplayFromEmail(email: string): string {
  const beforeAt = (email ?? "").split("@")[0] || "user";
  const token = beforeAt.split(/[._-]/)[0] || "user";
  return token.charAt(0).toUpperCase() + token.slice(1);
}
