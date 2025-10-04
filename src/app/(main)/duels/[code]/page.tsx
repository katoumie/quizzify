// src/app/(main)/duels/[code]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PlayerRow = {
  id: string;
  name: string;
  avatar: string | null;
  isReady: boolean;
  lives: number;
  role: string;
};

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [hostId, setHostId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // SSE hookup
  useEffect(() => {
    const es = new EventSource(`/api/duels/${encodeURIComponent(code)}/sse`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "snapshot") {
          setHostId(msg.payload.hostId ?? null);
          setPlayers(msg.payload.players ?? []);
          setLoading(false);
        } else if (msg.type === "ready") {
          // Optional: update readiness live if you publish this event elsewhere
          setPlayers((prev) =>
            prev.map((p) => (p.id === msg.playerId ? { ...p, isReady: !!msg.ready } : p))
          );
        } else if (msg.type === "go-arena") {
          router.push(`/duels/${code}/arena`);
        }
      } catch {}
    };
    es.onerror = () => {
      // Let EventSource auto-retry; show loading for first failure only
      setLoading(false);
    };
    return () => es.close();
  }, [code, router]);

  const everyoneReady =
    players.length >= 2 && players.every((p) => p.role !== "PLAYER" || p.isReady);

  const onStart = async () => {
    try {
      await fetch(`/api/duels/${encodeURIComponent(code)}/start`, { method: "POST" });
      // Host will also be redirected by the SSE "go-arena" message
    } catch {
      // As a fallback, still push:
      router.push(`/duels/${code}/arena`);
    }
  };

  return (
    <main className="min-h-[100svh] bg-[#0a092d] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-xl font-semibold">Duels Lobby</h1>
        <div className="mt-2 text-white/70 text-sm">Code: <span className="font-mono">{code}</span></div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-2 text-sm text-white/80">
            Players ({players.length})
          </div>
          <ul className="divide-y divide-white/10">
            {loading ? (
              <li className="px-4 py-3 text-white/70">Loading…</li>
            ) : players.length === 0 ? (
              <li className="px-4 py-3 text-white/70">Waiting for players…</li>
            ) : (
              players.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                  {p.avatar ? (
                    <img src={p.avatar} alt="" className="h-7 w-7 rounded-full ring-1 ring-white/15 object-cover" />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-white/10 ring-1 ring-white/15 inline-block" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="text-xs text-white/60">
                      {p.isReady ? "Ready" : "Not ready"}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onStart}
            disabled={!everyoneReady}
            className={`h-9 px-3 rounded-md text-sm font-medium ring-1 ring-white/20 ${
              everyoneReady ? "bg-[#532e95] hover:bg-[#5f3aa6]" : "bg-white/10 text-white/60 cursor-not-allowed"
            }`}
          >
            Start
          </button>

          <button
            type="button"
            onClick={() => router.push(`/duels/${code}/arena`)}
            className="h-9 px-3 rounded-md text-sm font-medium ring-1 ring-white/20 bg-white/10 hover:bg-white/15"
            title="Skip readiness (debug)"
          >
            Force start (debug)
          </button>
        </div>
      </div>
    </main>
  );
}
