// /src/components/library/utils.ts
"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SetCardData } from "@/components/SetCard";

export const SESSION_KEY = "qz_auth";

// Visibility/liked filter (UI label: "Filter")
export type FilterKey = "all" | "public" | "private" | "friends" | "liked";
// Sort order (UI label: "Sort")
export type OrderKey = "updated" | "likes" | "name";

export type FolderLite = { id: string; name: string; createdAt: string; _count: { sets: number } };

/** Persist unlike on the backend and keep local lists in sync */
export async function unlikeSetForUser(
  setId: string,
  userId: string,
  update: {
    setLikedSets: Dispatch<SetStateAction<SetCardData[]>>;
    setRecentSets: Dispatch<SetStateAction<SetCardData[]>>;
  }
) {
  let res = await fetch(`/api/sets/${encodeURIComponent(setId)}/like`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ userId, ownerId: userId }),
  });

  if (!res.ok) {
    res = await fetch(
      `/api/sets/${encodeURIComponent(setId)}/like?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE", credentials: "same-origin" }
    );
  }

  let js: any = {};
  try {
    js = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(js?.error || "Failed to unlike.");
  }

  update.setLikedSets((r) => r.filter((x) => x.id !== setId));
  update.setRecentSets((r) =>
    r.map((x) =>
      x.id === setId ? { ...x, likeCount: Math.max(0, (x.likeCount ?? 0) - 1) } : x
    )
  );
}

/** Simple relative time formatter */
export function fmtRel(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return d.toLocaleDateString();
  if (day >= 1) return `${day}d ago`;
  if (hr >= 1) return `${hr}h ago`;
  if (min >= 1) return `${min}m ago`;
  return `just now`;
}
