// /src/app/sets/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SetForm from "@/components/set-form/SetForm";
import type { SetFormInitialData } from "@/types/set";

export default function EditSetPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SetFormInitialData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/sets/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          if (alive) setError(json?.error || "Failed to load set.");
          return;
        }
        if (!alive) return;

        const initialData: SetFormInitialData = {
          id: json.id,
          title: json.title,
          description: json.description ?? "",
          isPublic: Boolean(json.isPublic),
          defaultSkillName: json?.defaultSkill?.name ?? null,
          cards: (json.cards || []).map((c: any) => ({
            id: c.id,
            term: c.term,
            definition: c.definition,
            imageUrl: c.imageUrl ?? null,
            position: c.position ?? 0,
            skill: c.skill ?? null,
            inheritDefault: Boolean(c.inheritDefault),
          })),
        };
        setData(initialData);
      } catch {
        if (alive) setError("Network error.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">
        Loading…
      </div>
    );
  }

  return <SetForm mode="edit" initialData={data} />;
}
