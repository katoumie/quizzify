// /src/components/AppShell.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import NotificationsPanel from "@/components/NotificationsPanel";
import Sidebar from "@/components/Sidebar";
import NavSearch from "@/components/NavSearch";
import CreateMenu from "@/components/CreateMenu";
import ProfileMenu from "@/components/ProfileMenu";
import SubnavLibrary from "@/components/SubnavLibrary";

const SESSION_KEY = "qz_auth";

// Header metrics
const NAV_H = 60;        // top bar height
const HEADER_BORDER = 1; // bottom border thickness of the header

type AvatarObj = { kind: "builtin" | "upload"; src: string };
type Avatar = string | AvatarObj | null | undefined;

type SessionUser = {
  id: string;
  email: string;
  username?: string | null;
  createdAt?: string;
  avatar?: Avatar;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // session display
  const [displayName, setDisplayName] = useState("User");
  const [initial, setInitial] = useState("U");
  const [email, setEmail] = useState<string>("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileHref, setProfileHref] = useState<string>("/u/me");

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
        const derived = session.username?.trim()
          ? session.username.trim()
          : deriveDisplayFromEmail(em);

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
    localStorage.removeItem(SESSION_KEY);
    router.replace("/signin");
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/main" && pathname?.startsWith(href));

  const onSetStatus = () => {
    console.log("Open Set Status modal");
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

  const showLibraryTabs = pathname?.startsWith("/library") ?? false;

  // Sidebar offset (no extra subnav height anymore)
  const sidebarTopPx = NAV_H + HEADER_BORDER;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      {/* ===== Single Sticky Navbar (60px) with inline tabs on /library ===== */}
      <div
        className="sticky top-0 z-50 w-full border-b border-white/15"
        style={{ backgroundColor: "#18062e" }}
      >
        <div className="relative h-[60px] px-4 flex items-center justify-between gap-3">
          {/* Left: logo */}
          <div className="flex items-center gap-3">
            <Link href="/main" aria-label="Quizzify home" className="flex items-center gap-3 no-underline">
              <Image
                src="/logo-q.svg"
                alt="Quizzify"
                width={32}
                height={32}
                priority
                className="h-8 w-auto select-none"
                draggable={false}
              />
            </Link>
          </div>

          {/* Center (inline tabs) — absolutely positioned so the left edge aligns to 240 + 12 */}
          {showLibraryTabs && <SubnavLibrary />}

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

      {/* ===== Sidebar ===== */}
      <aside
        id="app-sidebar"
        className="fixed left-0 z-30 w-[240px] px-2 pt-2 border-r border-white/15"
        style={{
          background: "var(--sidebar-bg)",
          top: sidebarTopPx,
          height: `calc(100vh - ${sidebarTopPx}px)`,
        }}
      >
        <Sidebar
          isActive={(href) => isActive(href)}
          onNotifications={() => window.dispatchEvent(new CustomEvent("qz:open-notifs"))}
        />
      </aside>

      {/* ===== Main ===== */}
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

function deriveDisplayFromEmail(email: string): string {
  const beforeAt = (email ?? "").split("@")[0] || "user";
  const token = beforeAt.split(/[._-]/)[0] || "user";
  return token.charAt(0).toUpperCase() + token.slice(1);
}
