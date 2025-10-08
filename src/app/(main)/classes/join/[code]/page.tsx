// /src/app/(main)/classes/join/[code]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinClassByCodePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve invite code -> class name (so we can show "You are being invited to <name>").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/classes/resolve?code=${encodeURIComponent(String(code))}`, { cache: "no-store" });
        if (res.status === 401) {
          // not signed in — go sign in, then bounce back here
          const next = encodeURIComponent(`/classes/join/${code}`);
          router.replace(`/signin?next=${next}`);
          return;
        }
        const js = await res.json().catch(() => ({}));
        if (!res.ok || !js?.name) {
          if (!cancelled) setError(js?.error || "Invalid or expired invite code.");
        } else if (!cancelled) {
          setName(js.name);
        }
      } catch {
        if (!cancelled) setError("Network error while checking invite.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  const onAccept = async () => {
    try {
      setJoining(true);
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        const next = encodeURIComponent(`/classes/join/${code}`);
        router.replace(`/signin?next=${next}`);
        return;
      }
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.id) {
        alert(js?.error || "Could not join class.");
        setJoining(false);
        return;
      }
      router.replace(`/classes/${js.id}`);
    } catch (e: any) {
      alert(e?.message || "Network error.");
      setJoining(false);
    }
  };

  const onDecline = () => router.replace("/classes");

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
        <h1 className="text-lg font-semibold">Class invitation</h1>

        <div className="mt-3 border-t border-white/10" />

        <div className="mt-4 text-white/85 text-[15px]">
          {loading ? (
            "Checking invite…"
          ) : error ? (
            <span className="text-red-300">{error}</span>
          ) : (
            <>You are being invited to <span className="font-semibold">{name}</span> class.</>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="h-9 px-3 rounded-[8px] text-white/85 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={joining || !!error}
            onClick={onAccept}
            className={[
              "inline-flex items-center gap-1.5 rounded-[8px]",
              "h-9 px-3",
              "text-white/90 hover:text-white",
              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
              "ring-1 ring-white/20 hover:ring-white/10",
              "transition-colors",
              "text-sm font-medium",
              joining || error ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {joining ? "Joining…" : "Accept"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-white/50">
        You’ll be redirected to the class page after accepting.
      </p>
    </div>
  );
}
