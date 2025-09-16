"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCheck, Trash2, Clock, Star, Trophy, Sparkles, Bell } from "lucide-react";

export type Notification = {
  id: string;
  title: string;
  body?: string;
  time: Date | string;
  unread?: boolean;
  type?: "badge" | "streak" | "system" | "set" | "like" | "comment";
  href?: string;
};

const ACCENT = "#a8b1ff"; // your accent
const DARK_BG = "#0a092d"; // your app background

function formatRelative(t: Date | string) {
  const d = typeof t === "string" ? new Date(t) : t;
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

const demo: Notification[] = [
  {
    id: "n1",
    title: "New badge unlocked: Perfectionist",
    body: "Score 100% on any set.",
    time: new Date(Date.now() - 1000 * 60 * 3),
    unread: true,
    type: "badge",
  },
  {
    id: "n2",
    title: "Streak saved!",
    body: "You studied 12 minutes today.",
    time: new Date(Date.now() - 1000 * 60 * 45),
    unread: true,
    type: "streak",
  },
  {
    id: "n3",
    title: "AI-generated set is ready",
    body: "Basic Electronics – 25 items.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unread: false,
    type: "set",
  },
  {
    id: "n4",
    title: "System update",
    body: "Spaced-repetition tuning shipped.",
    time: new Date(Date.now() - 1000 * 60 * 60 * 27),
    unread: false,
    type: "system",
  },
];

function TypeIcon({ type }: { type?: Notification["type"] }) {
  const cls = "shrink-0";
  switch (type) {
    case "badge":
      return <Trophy className={cls} />;
    case "streak":
      return <Sparkles className={cls} />;
    case "set":
      return <Star className={cls} />;
    case "system":
    default:
      return <Clock className={cls} />;
  }
}

// Allow `window.dispatchEvent(new CustomEvent("qz:open-notifs"))` to open the panel.
declare global {
  interface WindowEventMap {
    "qz:open-notifs": CustomEvent;
  }
}

export default function NotificationsPanel({
  initial,
  accent = ACCENT,
}: {
  initial?: Notification[];
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(initial ?? demo);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerFocusRef = useRef<HTMLElement | null>(null);

  const unread = useMemo(() => items.filter((n) => n.unread).length, [items]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("qz:open-notifs", onOpen as EventListener);
    return () => window.removeEventListener("qz:open-notifs", onOpen as EventListener);
  }, []);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus management when opening
  useEffect(() => {
    if (open) {
      const el = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      el?.focus();
      // auto-mark as read shortly after open (mock behavior)
      const t = setTimeout(() => setItems((prev) => prev.map((n) => ({ ...n, unread: false }))), 500);
      return () => clearTimeout(t);
    } else {
      triggerFocusRef.current?.focus?.();
    }
  }, [open]);

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  }
  function clearAll() {
    setItems([]);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.button
            key="backdrop"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[110] bg-black/40"
            aria-label="Close notifications"
          />

          {/* Slide-over */}
          <motion.div
            key="panel"
            ref={panelRef}
            initial={{ x: 420, opacity: 0.96 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="fixed right-0 top-0 z-[120] h-dvh w-[92vw] max-w-[420px] border-l border-white/10 text-white shadow-2xl"
            style={{ backgroundColor: DARK_BG }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/0 px-5 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Notifications</h2>
                {unread > 0 && (
                  <span
                    style={{ backgroundColor: ACCENT, color: "#0a0a0a" }}
                    className="inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium"
                  >
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={markAllRead}
                  data-autofocus
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-sm hover:bg-white/5"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-sm hover:bg-white/5"
                  aria-label="Delete all"
                  title="Delete all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 hover:bg-white/5"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex h-[calc(100dvh-64px)] flex-col overflow-y-auto px-4 pb-6 pt-3">
              {items.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="space-y-3">
                  {items.map((n) => (
                    <li key={n.id}>
                      <article
                        className={`group relative overflow-hidden rounded-2xl border border-white/10 p-4 shadow-lg ${
                          n.unread ? `ring-1` : ""
                        }`}
                        style={n.unread ? { boxShadow: "0 0 0 1px rgba(168,177,255,0.40) inset" } : undefined}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                            style={{ color: ACCENT }}
                            aria-hidden
                          >
                            <TypeIcon type={n.type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[15px] font-medium">{n.title}</h3>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-sm opacity-80">{n.body}</p>}
                            <p className="mt-1 text-xs opacity-60">{formatRelative(n.time)}</p>
                          </div>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center opacity-90">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Bell />
      </div>
      <h3 className="text-base font-medium">You're all caught up</h3>
      <p className="mt-1 max-w-[24ch] text-sm opacity-70">
        New alerts about badges, streaks, and AI-generated sets will appear here.
      </p>
    </div>
  );
}
