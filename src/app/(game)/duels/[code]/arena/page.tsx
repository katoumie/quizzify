// /src/app/(game)/duels/[code]/arena/page.tsx
"use client";

import { useParams } from "next/navigation";

export default function ArenaPage() {
  const { code } = useParams<{ code: string }>();
  return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Arena Mode</h1>
        <p className="mt-2 text-white/70">Room code: {code}</p>
        <p className="mt-4 text-sm text-white/50">Game UI coming soon…</p>
      </div>
    </main>
  );
}
