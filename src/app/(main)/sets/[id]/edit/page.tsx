// /src/app/sets/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SetForm, { type SetFormInitialData } from "@/components/SetForm";

export default function EditSetPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SetFormInitialData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`/api/sets/${id}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error || "Failed to load set.");
          return;
        }
        if (!alive) return;

        setData({
          id: json.id,
          title: json.title,
          description: json.description ?? "",
          isPublic: Boolean(json.isPublic),
          cards: (json.cards || []).map((c: any) => ({
            id: c.id,
            term: c.term,
            definition: c.definition,
            imageUrl: c.imageUrl ?? null, // 👈 include images
          })),
        });
      } catch {
        setError("Network error.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">
          Loading…
        </div>
      ) : (
        <SetForm mode="edit" initialData={data} />
      )}
    </>
  );
}
