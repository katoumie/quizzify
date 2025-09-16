"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "qz_auth";
type Mode = "signin" | "signup";
type Role = "STUDENT" | "TEACHER" | "ADMIN";

// 3–20 chars, start with a letter, letters/numbers/underscore
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [teacherOn, setTeacherOn] = useState(false); // 👈 controls role
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce to /main
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        if (u?.id) router.replace("/main");
      } catch {}
    }
  }, [router]);

  // Domain-based theme (Perpetual palette)
  const isPerpetual = useMemo(() => {
    const host = email.split("@")[1]?.toLowerCase() || "";
    return host.endsWith("perpetual.edu.ph");
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      const u = username.trim();
      if (!USERNAME_REGEX.test(u)) {
        setError(
          "Username must be 3–20 chars, start with a letter, and use letters, numbers, or underscores only."
        );
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        mode === "signin"
          ? { email: email.trim().toLowerCase(), password }
          : {
              email: email.trim().toLowerCase(),
              password,
              username: username.trim(),
              role: teacherOn ? ("TEACHER" as Role) : ("STUDENT" as Role), // 👈 send role
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong");
        return;
      }

      // Save the FULL user object as returned by the API (includes avatar/role)
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));

      // Tell any mounted AppShells to refresh immediately
      window.dispatchEvent(new Event("qz:session-updated"));

      router.push("/main");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={`${isPerpetual ? "theme-perpetual" : "theme-default"} min-h-screen flex items-center justify-center text-white p-6`}
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md">
        {/* Header / Brand */}
        <div className="rounded-2xl px-5 py-4 mb-4 border border-white/10 bg-[var(--bg-card)] backdrop-blur">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Quizzify</h1>
            <span
              className="text-xs px-2 py-1 rounded-md"
              style={{ backgroundColor: "var(--brand)", color: "var(--btn-contrast)" }}
              title={isPerpetual ? "Perpetual theme preview" : "Default theme"}
            >
              {isPerpetual ? "Perpetual Theme" : "Default Theme"}
            </span>
          </div>
          <p className="text-sm text-white/70 mt-1">
            {mode === "signin" ? "Welcome back! Sign in to continue." : "Create an account to get started."}
          </p>
        </div>

        {/* Toggle signin/signup */}
        <div className="flex w-full mb-4 rounded-xl overflow-hidden border border-white/10">
          <button
            onClick={() => setMode("signin")}
            className={`w-1/2 py-2 text-sm transition ${mode === "signin" ? "bg-[var(--hover-bg)]" : "bg-transparent"}`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`w-1/2 py-2 text-sm transition ${mode === "signup" ? "bg-[var(--hover-bg)]" : "bg-transparent"}`}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="w-full space-y-4 bg-[var(--bg-card)] p-6 rounded-2xl border border-white/10 backdrop-blur">
          {mode === "signup" && (
            <>
              <div className="space-y-1">
                <label className="text-sm">Username</label>
                <input
                  className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={(e) => setUsername(e.target.value.trim())}
                  placeholder="e.g., juandelacruz"
                  required
                />
                <p className="text-xs text-white/60">
                  3–20 chars, start with a letter; letters, numbers, or underscores only.
                </p>
              </div>

              {/* I am a teacher toggle */}
              <div className="mt-1 flex items-center justify-between gap-3 select-none">
                <div className="min-w-0">
                  <label className="text-sm text-white/90">I am a teacher</label>
                  <p className="text-xs text-white/60">Enable an educator account</p>
                </div>
                <Toggle
                  checked={teacherOn}
                  onChange={setTeacherOn}
                  ariaLabel="Toggle teacher role"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm">Email</label>
            <input
              className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Password</label>
            <input
              className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              required
            />
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            disabled={loading}
            className="w-full h-11 rounded-xl px-4 text-center text-sm font-bold transition hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand)", color: "var(--btn-contrast)" }}
          >
            {loading ? (mode === "signin" ? "Signing in..." : "Creating...") : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <p className="text-xs text-white/70">By continuing, you agree to the Terms and Privacy Policy.</p>
        </form>
      </div>

      {/* Theme tokens for this page */}
      <style jsx global>{`
        :root {
          --bg: #0a092d;
          --brand: #4262ff;
          --hover-bg: rgba(255, 255, 255, 0.08);
          --bg-card: rgba(255, 255, 255, 0.05);
          --btn-contrast: #ffffff;
        }
        .theme-perpetual {
          --bg: #2a0b0b;
          --brand: #f8cd00;
          --hover-bg: rgba(248, 205, 0, 0.12);
          --bg-card: rgba(255, 255, 255, 0.06);
          --btn-contrast: #000000;
        }
        .theme-default {
          --bg: #0a092d;
          --brand: #4262ff;
          --hover-bg: rgba(255, 255, 255, 0.08);
          --bg-card: rgba(255, 255, 255, 0.05);
          --btn-contrast: #ffffff;
        }
      `}</style>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-[26px] w-[46px] items-center rounded-full transition-colors
        ${checked ? "bg-[var(--brand)]" : "bg-white/30"} 
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform
          ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}
