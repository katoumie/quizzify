// /src/app/(main)/duels/[code]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* ===== Types for Lobby SSE ===== */
type PlayerLite = {
  id: string;                 // DuelPlayer.id
  userId: string | null;      // for "(you)" + host detection
  displayName: string;
  username: string | null;
  avatar: string | null;
  isReady: boolean;
  lives: number;              // kept (not shown)
  role: "PLAYER" | "SPECTATOR" | string;
  connectedAt?: string;
};

type LobbySession = {
  id: string;
  code: string;
  status: "LOBBY" | "RUNNING" | "ENDED" | "CANCELLED" | string;
  hostId: string | null;
  setId: string;
  players: PlayerLite[];
};

type HelloMsg = { type: "hello"; mode: string; code: string; sessionId: string };
type LobbyStateMsg = { type: "lobby-state"; session: LobbySession };
type HeartbeatMsg = { type: "hb"; ts: number };
type WarnMsg = { type: "warn"; message: string };
type ErrorMsg = { type: "error"; message: string };
type SseMsg = HelloMsg | LobbyStateMsg | HeartbeatMsg | WarnMsg | ErrorMsg;
/* ================================= */

const SESSION_KEY = "qz_auth";

export default function DuelLobbyPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();

  const [meId, setMeId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false); // ensure we wait for localStorage
  const [session, setSession] = useState<LobbySession | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const joinedRef = useRef(false);       // avoid multiple join POSTs
  const navigatingRef = useRef(false);   // avoid double navigation on RUNNING

  // Read current user id (once)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) setMeId(u.id);
      }
    } catch { /* ignore */ }
    setAuthChecked(true);
  }, []);

  // JOIN the lobby (idempotent), ONLY after authChecked
  useEffect(() => {
    if (!code || !authChecked || joinedRef.current) return;

    joinedRef.current = true;
    (async () => {
      try {
        const name =
          (typeof window !== "undefined" && localStorage.getItem("qz_display_name")) ||
          undefined;

        // If signed-in, omit displayName (server will use username)
        const body = meId
          ? { userId: meId }
          : { displayName: name ?? "Player" }; // guests still need a name

        await fetch(`/api/duels/${encodeURIComponent(String(code))}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch { /* ignore */ }
    })();
  }, [code, authChecked, meId]);

  // Subscribe to SSE for live lobby updates and status-driven navigation
  useEffect(() => {
    if (!code) return;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = `/api/duels/${encodeURIComponent(String(code))}/sse`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    es.onmessage = (e) => {
      if (!e.data) return;
      let msg: SseMsg;
      try { msg = JSON.parse(e.data); } catch { return; }

      switch (msg.type) {
        case "hello":
          break;
        case "lobby-state":
          setSession(msg.session);
          // If session started, everyone navigates
          if (msg.session?.status === "RUNNING" && !navigatingRef.current) {
            navigatingRef.current = true;
            router.push(`/duels/${code}/arena`);
          }
          break;
        default:
          break;
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      setSseConnected(false);
    };
  }, [code, router]);

  const players = useMemo(() => session?.players ?? [], [session]);

  const isHost = useMemo(() => {
    if (!session || !meId) return false;
    return session.hostId === meId;
  }, [session, meId]);

  return (
    <div className="min-h-screen bg-[var(--bg,#0a092d)] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lobby • {String(code).toUpperCase()}</h1>
          <div
            className={[
              "rounded px-2 py-0.5 text-xs ring-1",
              sseConnected
                ? "bg-emerald-500/10 ring-emerald-400/30 text-emerald-200"
                : "bg-red-500/10 ring-red-400/30 text-red-200",
            ].join(" ")}
            title={sseConnected ? "Connected to lobby updates" : "Reconnecting..."}
          >
            {sseConnected ? "LIVE" : "RETRYING"}
          </div>
        </div>

        {/* Lobby roster */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm text-white/70">Players</div>

          {players.length === 0 ? (
            <div className="mt-3 text-white/60 text-sm">Waiting for players to join…</div>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {players.map((p) => {
                const you = p.userId && meId ? p.userId === meId : false;
                const isLobbyHost = session?.hostId && p.userId === session.hostId;
                const roleLabel = isLobbyHost ? "PLAYER/HOST" : "PLAYER";

                return (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    {p.avatar ? (
                      <img src={p.avatar} className="h-8 w-8 rounded-full ring-1 ring-white/15 object-cover" alt="" />
                    ) : (
                      <span className="h-8 w-8 rounded-full ring-1 ring-white/15 bg-white/10 inline-block" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {p.displayName || p.username || "Player"}
                          {you ? " (you)" : ""}
                        </span>
                        {isLobbyHost && (
                          <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[11px] text-yellow-200 ring-1 ring-yellow-400/25">
                            Host
                          </span>
                        )}
                        {p.isReady && (
                          <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[11px] text-emerald-300 ring-1 ring-emerald-400/20">
                            Ready
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/60">Role: {roleLabel}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Bottom actions */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="h-8 rounded-[6px] bg-white/10 px-2.5 text-sm ring-1 ring-white/15 hover:bg-white/15"
          >
            Copy invite link
          </button>

          {isHost ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 rounded-[6px] bg-white/10 px-2.5 text-sm ring-1 ring-white/15 hover:bg-white/15"
                onClick={() => router.refresh()}
              >
                Refresh
              </button>
              <button
                type="button"
                className="h-8 rounded-[6px] bg-[#532e95] px-3 text-sm ring-1 ring-white/20 hover:bg-[#5f3aa6]"
                onClick={async () => {
                  if (!meId) return; // must be signed-in host
                  try {
                    const res = await fetch(`/api/duels/${code}/start`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: meId }),
                    });
                    const js = await res.json();
                    if (!res.ok) {
                      alert(js?.error || "Could not start the session.");
                      return;
                    }
                    // Optional: host navigates immediately for snappy UX.
                    if (!navigatingRef.current) {
                      navigatingRef.current = true;
                      router.push(`/duels/${code}/arena`);
                    }
                  } catch {
                    alert("Network error. Please try again.");
                  }
                }}
              >
                Start
              </button>
            </div>
          ) : (
            <div className="text-sm text-white/70">Waiting for host to start…</div>
          )}
        </div>
      </div>
    </div>
  );
}
