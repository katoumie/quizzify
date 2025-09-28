"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Phase = "lobby" | "question" | "resolving" | "summary";
type Snap = {
  phase: Phase;
  round: number;
  timeLimit: number;
  remaining?: number;
  question?: { id: string; stem: string };
  options?: string[];
};

const PLAYER_KEY = (code: string) => `duels:${code}:playerId`; // same as your Lobby
const LS_BGM = "qz_bgm_enabled";

export default function ArenaPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = Array.isArray(raw) ? raw[0] : raw;
  const router = useRouter();

  const [snap, setSnap] = useState<Snap | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // BGM (optional)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem(LS_BGM);
    return raw == null ? true : raw === "1";
  });

  // local countdown fallback
  const [remaining, setRemaining] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerId = useMemo(() => {
    if (!code || typeof window === "undefined") return undefined;
    return localStorage.getItem(PLAYER_KEY(code)) || undefined;
  }, [code]);

  // ----- Helpers
  const startTick = (startFrom: number) => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRemaining(startFrom);
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r == null) return r;
        if (r <= 1) {
          clearInterval(tickRef.current!);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const stopTick = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setRemaining(null);
  };

  const fetchState = async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/duels/${code}/arena/state`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const s = (await res.json()) as Snap & { correctIndex?: number };
      setSnap(s);
      if (s.phase === "question") {
        startTick(typeof s.remaining === "number" ? s.remaining : s.timeLimit);
      } else {
        stopTick();
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load state.");
    }
  };

  // ----- SSE
  useEffect(() => {
    if (!code) return;
    let stopped = false;

    const source = new EventSource(`/api/duels/${code}/sse`);
    source.onmessage = (ev) => {
      // default channel: treat as generic message; we still refetch to be safe
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "snapshot") {
          // lobby snapshot; ignore here
        }
      } catch {}
    };
    source.addEventListener("round-start", () => {
      fetchState();
      setAnswering(null);
    });
    source.addEventListener("answer", () => {
      // optional: could reflect opponent answers; we just stay optimistic
    });
    source.addEventListener("round-resolve", () => {
      fetchState();
      setAnswering(null);
    });
    source.addEventListener("start", () => {
      // host started while we’re here – refresh state
      fetchState();
    });
    source.onerror = () => {
      // try polling after a hiccup
      if (!stopped) setTimeout(fetchState, 500);
    };

    fetchState();
    return () => {
      stopped = true;
      source.close();
      stopTick();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // BGM autostart (best effort)
  useEffect(() => {
    localStorage.setItem(LS_BGM, bgmEnabled ? "1" : "0");
    const el = audioRef.current;
    if (!el) return;
    el.loop = true;
    el.volume = 0.55;
    if (bgmEnabled) el.play().catch(() => {});
    else el.pause();
  }, [bgmEnabled]);

  // ----- Actions
  const submitAnswer = async (choice: string, idx: number) => {
    if (!code || !playerId || snap?.phase !== "question") return;
    if (answering != null) return;

    setAnswering(choice);
    try {
      await fetch(`/api/duels/${code}/arena/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          choiceIndex: idx,
          ms: typeof remaining === "number" && snap?.timeLimit
            ? (snap.timeLimit - remaining) * 1000
            : 0,
        }),
      });
      // server will push resolve after timer or immediately if needed
    } catch (e: any) {
      console.error(e);
      setAnswering(null);
    }
  };

  // ----- UI
  if (err) {
    return (
      <main className="min-h-dvh grid place-items-center text-red-300">
        <div className="text-sm bg-red-900/30 border border-red-700/40 rounded px-3 py-2 max-w-md">{err}</div>
      </main>
    );
  }

  if (!snap) {
    return (
      <main className="min-h-dvh grid place-items-center text-white/80">
        <Loader />
      </main>
    );
  }

  return (
    <main className="min-h-dvh w-full text-white relative overflow-hidden">
      {/* bgm element */}
      <audio ref={audioRef} src="/music/arena-bgm.mp3" preload="auto" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <button
          className="rounded-lg bg-white/10 hover:bg-white/15 ring-1 ring-white/20 px-3 py-1.5 text-sm"
          onClick={() => router.push(`/duels/${code}`)}
        >
          Leave
        </button>
        <div className="text-sm text-white/80">Round {snap.round ?? 1}</div>
        <Timer pct={snap.timeLimit ? (Math.max(0, (remaining ?? snap.remaining ?? snap.timeLimit)) / snap.timeLimit) : 0} label={Math.max(0, Math.ceil(remaining ?? snap.remaining ?? 0))} visible={snap.phase === "question"} />
      </div>

      {/* Center stage */}
      <div className="min-h-dvh grid place-items-center px-6">
        {/* LOBBY */}
        {snap.phase === "lobby" && (
          <div className="text-center text-white/75">
            Waiting for host to start…
          </div>
        )}

        {/* QUESTION */}
        {snap.phase === "question" && (
          <div className="w-full max-w-3xl space-y-6 pt-16">
            <div className="text-center text-xl leading-snug">
              {snap.question?.stem ?? "—"}
            </div>
            <div className="grid gap-3">
              {(snap.options ?? []).map((opt, i) => {
                const picked = answering === opt;
                return (
                  <button
                    key={`${i}-${opt}`}
                    onClick={() => submitAnswer(opt, i)}
                    disabled={!!answering}
                    className={[
                      "w-full text-left rounded-xl border px-4 py-3 text-[15px]",
                      "transition-transform hover:translate-y-[-1px]",
                      picked
                        ? "bg-[#532e95] border-white/20 ring-1 ring-white/25"
                        : "bg-[#18062e] border-white/12 hover:bg-white/10",
                      answering && !picked ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="text-center text-xs text-white/60">
              {answering ? "Answer locked. Waiting for result…" : "First correct wins. Be quick!"}
            </div>
          </div>
        )}

        {/* RESOLVING */}
        {snap.phase === "resolving" && (
          <div className="text-center text-white/80 pt-16">
            Resolving round…
          </div>
        )}

        {/* SUMMARY */}
        {snap.phase === "summary" && (
          <div className="text-center text-white/80 pt-16">
            Match summary coming soon.
          </div>
        )}
      </div>

      {/* Sound toggle */}
      <div className="fixed right-4 bottom-4 z-20">
        <button
          onClick={() => setBgmEnabled((v) => !v)}
          className="rounded-full px-3 py-2 text-sm ring-1 ring-white/20 bg-black/35 hover:bg-black/45 backdrop-blur"
          aria-pressed={bgmEnabled}
        >
          {bgmEnabled ? "🔊 On" : "🔇 Off"}
        </button>
      </div>
    </main>
  );
}

function Loader() {
  return <div className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />;
}

function Timer({ pct, label, visible }: { pct: number; label: number; visible: boolean }) {
  const R = 18;
  const C = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, pct)) * C;
  return (
    <div className="relative h-10 w-10">
      <svg className={`absolute inset-0 ${visible ? "" : "opacity-0"} transition-opacity`} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
        <circle cx="24" cy="24" r={R} fill="none" stroke="white" strokeWidth="4" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 24 24)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px]">{label}</div>
    </div>
  );
}
