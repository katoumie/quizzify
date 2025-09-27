// /src/app/(main)/duels/[code]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DuelMode = "ARENA" | "TEAM" | "STANDARD";
type DuelStatus = "LOBBY" | "RUNNING" | "ENDED";

type DuelPlayer = {
  id: string;
  userId?: string | null;
  displayName: string;
  team?: string | null;
  lives: number;
  score: number;
  isReady: boolean;
  eliminatedAt?: string | null;
  user?: { avatar?: string | null; username?: string | null } | null;
};

type DuelSession = {
  id: string;
  code: string;
  hostId: string;
  mode: DuelMode;
  status: DuelStatus;
  options: any;
  players: DuelPlayer[];
};

const SESSION_KEY = "qz_auth";
const PLAYER_KEY = (code: string) => `duels:${code}:playerId`;
const MAX_PLAYERS = 50;

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Request failed: ${path}`);
  return res.json();
}

function modeLabel(m?: DuelMode) {
  if (!m) return "—";
  return m === "ARENA" ? "Arena" : m === "TEAM" ? "Team" : "Standard";
}

function getAuthFromLocal(): { userId?: string; displayName?: string } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const u = JSON.parse(raw);
    const userId = u?.id ? String(u.id) : undefined;
    const displayName =
      (u?.username && String(u.username)) ||
      (u?.email && String(u.email).split("@")[0]) ||
      undefined;
    return { userId, displayName };
  } catch {
    return {};
  }
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function Lobby() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = Array.isArray(params?.code) ? params.code[0] : params?.code;

  const [session, setSession] = useState<DuelSession | null>(null);
  const [player, setPlayer] = useState<DuelPlayer | null>(null);
  const [status, setStatus] = useState<DuelStatus>("LOBBY");
  const [authUserId, setAuthUserId] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const sseRef = useRef<EventSource | null>(null);
  const joinedOnce = useRef(false);

  // --- tiny helper to route to gameplay ---
  const goPlay = () => {
    if (!code) return;
    router.replace(`/duels/${code}/arena`);
  };

  // Capture logged-in user id once on mount (used for robust host detection)
  useEffect(() => {
    const a = getAuthFromLocal();
    setAuthUserId(a.userId);
  }, []);

  // Host detection — resilient even before our own join finishes
  const isHost = useMemo(() => {
    const hostId = session?.hostId;
    if (!hostId) return false;
    if (player?.userId && player.userId === hostId) return true; // usual fast path
    if (authUserId && authUserId === hostId) return true; // fallback to local auth id
    const hostPlayer = session?.players?.find((p) => p.userId === hostId); // cross-check roster
    if (hostPlayer && hostPlayer.id === player?.id) return true;
    return false;
  }, [session?.hostId, session?.players, player?.id, player?.userId, authUserId]);

  const allReady = useMemo(() => {
    if (!session) return false;
    const others = session.players.filter((p) => p.userId !== session.hostId);
    return others.length > 0 ? others.every((p) => p.isReady) : true;
  }, [session]);

  const me = useMemo(() => session?.players?.find((p) => p.id === player?.id), [session, player]);

  // Initial meta (lets us show Mode/Players/Code immediately)
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const meta = await api<DuelSession>(`/api/duels/${code}`);
        if (!cancelled) {
          setSession(meta);
          setStatus(meta.status);
          // if server says already running (host refreshed, late join, etc.) => jump to play
          if (meta.status === "RUNNING") goPlay();
        }
      } catch {
        /* ignore; SSE will update */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- SSE: single connection for lobby updates + start signal ---
  useEffect(() => {
    if (!code) return;

    let closed = false;
    const connect = () => {
      if (closed) return;
      const source = new EventSource(`/api/duels/${code}/sse`);
      sseRef.current = source;

      source.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          switch (msg.type) {
            case "snapshot": {
              const snap: DuelSession = msg.payload;
              setSession(snap);
              setStatus(snap.status);
              if (snap.status === "RUNNING") goPlay(); // if match already running, hop in
              break;
            }
            case "players": {
              const { players } = msg;
              if (Array.isArray(players)) {
                setSession((prev) => (prev ? { ...prev, players } : prev));
              }
              break;
            }
            case "ready": {
              const { playerId, ready } = msg;
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      players: prev.players.map((p) =>
                        p.id === playerId ? { ...p, isReady: !!ready } : p
                      ),
                    }
                  : prev
              );
              break;
            }
            case "join": {
              const pl: DuelPlayer | undefined = msg.player;
              if (pl) {
                setSession((prev) =>
                  prev ? { ...prev, players: dedupePlayers([...prev.players, pl]) } : prev
                );
              }
              break;
            }
            case "leave": {
              const { playerId } = msg;
              setSession((prev) =>
                prev ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) } : prev
              );
              break;
            }
            case "start": {
              // server says match started -> mark running and go to play for everyone
              setStatus("RUNNING");
              setSession((prev) => (prev ? { ...prev, status: "RUNNING" } : prev));
              goPlay();
              break;
            }
            default:
              break;
          }
        } catch {
          /* ignore */
        }
      };

      source.onerror = () => {
        source.close();
        if (!closed) setTimeout(connect, 1000); // basic backoff
      };
    };

    connect();

    return () => {
      closed = true;
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // JOIN once (do not reopen SSE here)
  useEffect(() => {
    if (!code || joinedOnce.current) return;
    joinedOnce.current = true;

    let cancelled = false;
    (async () => {
      try {
        const storedId = localStorage.getItem(PLAYER_KEY(code)) || undefined;
        const ident = getAuthFromLocal();

        const joined = await api<DuelPlayer>(`/api/duels/${code}/join`, {
          method: "POST",
          body: JSON.stringify({
            playerId: storedId,
            userId: ident.userId,
            displayName: ident.displayName || "Player",
          }),
        });
        if (cancelled) return;

        setPlayer(joined);
        localStorage.setItem(PLAYER_KEY(code), joined.id);
      } catch (e: any) {
        console.error("Join failed:", e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  // Also react to local status changes (belt-and-suspenders)
  useEffect(() => {
    if (status === "RUNNING") goPlay();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Player actions
  const toggleReady = async () => {
    if (!session || !player) return;
    const now = !me?.isReady;
    try {
      await api(`/api/duels/${session.id}/ready`, {
        method: "POST",
        body: JSON.stringify({ playerId: player.id, ready: now }),
      });
      setSession((prev) =>
        prev
          ? {
              ...prev,
              players: prev.players.map((p) =>
                p.id === player.id ? { ...p, isReady: now } : p
              ),
            }
          : prev
      );
    } catch (e: any) {
      alert(e?.message || "Failed to update ready state.");
    }
  };

  const startGame = async (force = false) => {
    if (!session) return;
    if (!allReady && !force) return;
    try {
      const res = await api(`/api/duels/${session.id}/start`, {
        method: "POST",
        body: JSON.stringify({ force: !!force }),
      });
      // If host: optimistically jump to play. Others rely on SSE "start".
      if (isHost) goPlay();
      return res;
    } catch (e: any) {
      alert(e?.message || "Failed to start the game.");
    }
  };

  function dedupePlayers(list: DuelPlayer[]) {
    const byId = new Map<string, DuelPlayer>();
    for (const p of list) if (!byId.has(p.id)) byId.set(p.id, p);
    return Array.from(byId.values());
  }

  const onCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(session?.code || code || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      const el = document.createElement("textarea");
      el.value = session?.code || code || "";
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } finally {
        document.body.removeChild(el);
      }
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-6 text-white">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: title + meta */}
        <div className="min-w-[280px]">
          <h1 className="text-2xl font-semibold">Duels Lobby</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div>
              Mode:{" "}
              <span className="text-white/90 font-medium">{modeLabel(session?.mode)}</span>
            </div>
            <div>
              Players:{" "}
              <span className="text-white/90 font-medium">
                {session?.players?.length ?? 0}/{MAX_PLAYERS}
              </span>
            </div>
          </div>
        </div>

        {/* Right: code card + actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-[#18062e] ring-1 ring-white/12 px-3 py-2">
            <span className="font-mono tracking-wider text-lg text-white/95">
              {session?.code || code}
            </span>
            <button
              onClick={onCopyCode}
              className="ml-1 grid h-8 w-8 place-items-center rounded-md hover:bg-white/10 ring-1 ring-white/10"
              title="Copy code"
              aria-label="Copy code"
            >
              <img src="/icons/copy.svg" alt="" className="h-4 w-4 opacity-90" />
            </button>
            {copied && <span className="ml-1 text-xs text-emerald-300">Copied!</span>}
          </div>

          {!isHost ? (
            <button
              onClick={toggleReady}
              className={[
                "h-9 px-3 rounded-lg ring-1 text-sm font-medium transition-colors",
                me?.isReady
                  ? "bg-emerald-600/80 hover:bg-emerald-600 ring-white/20"
                  : "bg-[#532e95] hover:bg-[#5f3aa6] ring-white/20",
              ].join(" ")}
              title={me?.isReady ? "Click to unready" : "Click to ready up"}
            >
              {me?.isReady ? "Unready" : "Ready"}
            </button>
          ) : (
            <>
              <button
                onClick={() => startGame(false)}
                disabled={!allReady}
                className="h-9 px-3 rounded-lg bg-[#4255ff] enabled:hover:bg-[#3748e8] ring-1 ring-white/20 disabled:opacity-50 text-sm font-medium"
                title={allReady ? "Start the game" : "All non-host players must be ready"}
              >
                Start
              </button>
              <button
                onClick={() => {
                  if (!allReady) {
                    const ok = confirm("Some players aren't ready yet. Force start anyway?");
                    if (!ok) return;
                  }
                  startGame(true);
                }}
                className="h-9 px-3 rounded-lg bg-white/10 hover:bg.white/15 ring-1 ring-white/20 text-sm font-medium"
                title="Start even if not everyone is ready"
              >
                Force Start
              </button>
            </>
          )}
        </div>
      </header>

      {/* Players grid */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {session?.players?.map((p) => {
          const mine = p.id === player?.id;
          const isHostRow = p.userId === session?.hostId;
          const avatar = p.user?.avatar || null;

          return (
            <div
              key={p.id}
              className={[
                "rounded-[18px] p-4 bg-[#18062e] ring-1 ring-white/12",
                mine ? "outline outline-1 outline-[#6f4ccf]/40" : "",
                "flex flex-col items-center text-center gap-3",
              ].join(" ")}
            >
              {/* Circle avatar */}
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-1 ring-white/15"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg.white/10 grid place-items-center ring-1 ring-white/10">
                  <span className="text-lg font-semibold">{initials(p.displayName)}</span>
                </div>
              )}

              {/* Name + chips */}
              <div className="flex flex-wrap items-center justify-center gap-1">
                <span className="font-medium truncate max-w-[140px]" title={p.displayName}>
                  {p.displayName}
                </span>
                {mine && (
                  <span className="text-[10px] text-white/80 bg-white/10 px-2 py-0.5 rounded">
                    you
                  </span>
                )}
                {isHostRow && (
                  <span className="text-[10px] text-amber-200/90 bg-amber-500/10 ring-1 ring-amber-200/20 px-2 py-0.5 rounded">
                    host
                  </span>
                )}
              </div>

              {/* Status chip (non-hosts only) */}
              {!isHostRow && (
                <div>
                  <span
                    className={[
                      "inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] ring-1",
                      p.isReady
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20"
                        : "bg-white/5 text-white/70 ring-white/10",
                    ].join(" ")}
                  >
                    {p.isReady ? "Ready" : "Not ready"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {status === "RUNNING" && (
        <div className="mt-6 text-white/80">
          Redirecting to gameplay…
        </div>
      )}
    </main>
  );
}
