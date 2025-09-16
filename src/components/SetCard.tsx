"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

export type SetCardData = {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  createdAt: string;
  owner?: { id: string; username?: string | null; avatar?: string | null } | null;
  likeCount?: number; // 👈 we'll pass this in from library/page.tsx
};

export default function SetCard({
  data,
  isOwner,
  showActions,
  initiallyLiked,
  onEdit,
  onDelete,
  onToggleLike,
}: {
  data: SetCardData;
  isOwner: boolean;
  showActions: boolean;
  initiallyLiked: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLike?: (id: string, liked: boolean, likeCount: number) => void;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [likeCount, setLikeCount] = useState<number>(data.likeCount ?? 0);
  const [busy, setBusy] = useState(false);

  const createdLabel = useMemo(() => {
    try {
      return new Date(data.createdAt).toLocaleDateString();
    } catch {
      return data.createdAt;
    }
  }, [data.createdAt]);

  const canLike = !isOwner; // UI disable — API also enforces

  const handleToggleLike = useCallback(async () => {
    if (!canLike || busy) return;
    setBusy(true);
    try {
      const raw = localStorage.getItem("qz_auth");
      const u = raw ? JSON.parse(raw) : null;
      const userId = u?.id;
      if (!userId) {
        alert("Please sign in.");
        return;
      }
      const res = await fetch(`/api/sets/${data.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const js = await res.json();
      if (!res.ok) {
        alert(js?.error || "Failed to toggle like.");
        return;
      }
      setLiked(js.liked);
      setLikeCount(js.likeCount ?? likeCount);
      onToggleLike?.(data.id, js.liked, js.likeCount ?? likeCount);
    } catch {
      alert("Network error.");
    } finally {
      setBusy(false);
    }
  }, [canLike, busy, data.id, likeCount, onToggleLike]);

  // Build profile href from username if available, otherwise id
  const profileHandle =
    (data.owner?.username && data.owner.username.trim()) || data.owner?.id || null;
  const profileHref = profileHandle ? `/u/${encodeURIComponent(profileHandle)}` : null;

  return (
    <div className="group relative rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4 text-white shadow-sm hover:shadow transition">
      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="line-clamp-1 text-base font-semibold">{data.title}</h3>
          {data.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-white/70">{data.description}</p>
          ) : null}
        </div>

        {/* Actions (owner only, hidden on Liked view) */}
        {showActions && (
          <div className="ml-2 flex shrink-0 items-center gap-1 opacity-90">
            <IconButton title="Edit" onClick={() => onEdit(data.id)}>
              <EditIcon />
            </IconButton>
            <IconButton title="Delete" onClick={() => onDelete(data.id)}>
              <TrashIcon />
            </IconButton>
          </div>
        )}
      </div>

      {/* Footer: owner + visibility + created date */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {/* Owner identity (avatar + name) — clickable when we have a profile handle */}
        {profileHref ? (
          <Link
            href={profileHref}
            className="flex items-center gap-2 min-w-0 hover:opacity-90 focus:outline-none"
          >
            <Avatar src={data.owner?.avatar} alt={data.owner?.username || "User"} />
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight line-clamp-1">
                {data.owner?.username || "Unknown"}
              </div>
              <div className="text-xs text-white/60">
                {data.isPublic ? "Public" : "Private"} • Created {createdLabel}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={data.owner?.avatar} alt={data.owner?.username || "User"} />
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight line-clamp-1">
                {data.owner?.username || "Unknown"}
              </div>
              <div className="text-xs text-white/60">
                {data.isPublic ? "Public" : "Private"} • Created {createdLabel}
              </div>
            </div>
          </div>
        )}

        {/* Like area */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={!canLike || busy}
            className={`grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/15 transition
              ${liked ? "bg-[var(--brand)] text-[var(--btn-contrast)]" : "bg-white/10 text-white/90 hover:bg-white/14"}
              ${!canLike ? "opacity-60 cursor-not-allowed" : ""}`}
            title={!canLike ? "You cannot like your own set" : liked ? "Unlike" : "Like"}
            aria-pressed={liked}
          >
            <HeartIcon filled={liked} />
          </button>
          <div className="mt-1 text-[11px] text-white/70 tabular-nums">{likeCount} Likes</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small UI bits ---------- */
function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="grid h-9 w-9 place-items-center rounded-lg text-white/90 ring-1 ring-white/15 hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function Avatar({ src, alt }: { src?: string | null; alt?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || "avatar"}
      className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15"
    />
  ) : (
    <div className="h-9 w-9 rounded-full bg-white/10 ring-1 ring-white/15" />
  );
}

/* ---------- Icons ---------- */
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 12h10l1-12" />
    </svg>
  );
}
function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.35-9.5-8.57C.93 9.35 2.59 6 6.05 6 8.05 6 9.6 7.2 12 9.5 14.4 7.2 15.95 6 17.95 6c3.46 0 5.12 3.35 3.55 6.43C19.5 16.65 12 21 12 21z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M20.5 12.43C22.07 9.35 20.41 6 16.95 6 14.95 6 13.4 7.2 11 9.5 8.6 7.2 7.05 6 5.05 6 1.59 6-.07 9.35 1.5 12.43 3.5 16.65 11 21 11 21s7.5-4.35 9.5-8.57Z" />
    </svg>
  );
}
