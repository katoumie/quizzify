// /src/components/auth/AuthForm.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SESSION_KEY = "qz_auth";
type Mode = "signin" | "signup";
type Role = "STUDENT" | "TEACHER" | "ADMIN";

// 3–20 chars, start with a letter, letters/numbers/underscore
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [teacherOn, setTeacherOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill ?email=
  useEffect(() => {
    const qpEmail = searchParams.get("email") || "";
    if (qpEmail) setEmail(qpEmail);
  }, [searchParams]);

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

  // Cleanup old domain theme flags (legacy, safe to keep)
  useEffect(() => {
    try {
      localStorage.removeItem("qz_brand");
      localStorage.removeItem("qz_domainTheme");
      localStorage.removeItem("qz_perpetual");
    } catch {}
  }, []);

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
              role: teacherOn ? ("TEACHER" as Role) : ("STUDENT" as Role),
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

      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event("qz:session-updated"));
      router.push("/main");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const googleLabel = mode === "signin" ? "Continue with Google" : "Create account with Google";

  function handleGoogle() {
    // Wire up later, e.g. window.location.href = "/api/auth/signin/google";
    alert("Google sign-in coming soon.");
  }

  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-12 bg-[var(--bg)] text-[var(--foreground)]">
      {/* Auth card with faint outer glow */}
      <div className="relative w-full max-w-md">
        {/* faint outer glow */}
        <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(closest-side,rgba(168,177,255,0.45),transparent)] blur-2xl opacity-70" />
        <div className="relative rounded-2xl border border-white/10 bg-[var(--bg-card)] backdrop-blur p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          {/* Logo + title */}
          <div className="flex flex-col items-center">
            <div className="mb-3 rounded-full ring-1 ring-white/15 shadow">
              <Image src="/logo-q.png" alt="Quizzify" width={48} height={48} className="rounded-full" />
            </div>
            <h1 className="text-xl font-semibold">
              {mode === "signin" ? "Sign in to Quizzify" : "Create your account"}
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-sm">Username</label>
                <input
                  className="w-full rounded-md px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] text-[var(--foreground)]"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={(e) => setUsername(e.target.value.trim())}
                  placeholder="" // intentionally blank
                  required
                />
                {/* helper text intentionally removed */}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm">Email</label>
              <input
                className="w-full rounded-md px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] text-[var(--foreground)]"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm">Password</label>
                {mode === "signin" && (
                  <a href="#" className="text-xs text-white/70 hover:text-white">
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                className="w-full rounded-md px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] text-[var(--foreground)]"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=""
                required
              />
            </div>

            {/* Educator toggle ONLY on signup, placed lower */}
            {mode === "signup" && (
              <div className="mt-1 flex items-center justify-between gap-3 select-none">
                <div className="min-w-0">
                  <label className="text-sm text-white/90">Educator Account</label>
                </div>
                <Toggle checked={teacherOn} onChange={setTeacherOn} ariaLabel="Toggle teacher role" />
              </div>
            )}

            <button
              disabled={loading}
              className="w-full h-11 rounded-md px-4 text-center text-sm font-semibold transition hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--brand)", color: "var(--btn-contrast)" }}
            >
              {loading
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating..."
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </button>

            {/* Divider with gap */}
            <div className="my-3 flex items-center gap-3 select-none">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-xs text-white/60">or</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            {/* Google button with icon */}
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full h-11 rounded-md px-4 text-sm font-medium border border-white/15 bg-white/5 hover:bg-white/10 transition flex items-center justify-center gap-3 text-[var(--foreground)]"
            >
              <Image src="/google-logo.png" alt="Google" width={18} height={18} className="pointer-events-none" />
              <span>{googleLabel}</span>
            </button>

            {/* Bottom link */}
            <p className="text-xs text-white/70 text-center pt-1">
              {mode === "signin" ? (
                <>
                  New to Quizzify?{" "}
                  <a href="/signup" className="text-white hover:underline">
                    Create an account
                  </a>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <a href="/signin" className="text-white hover:underline">
                    Sign in
                  </a>
                </>
              )}
            </p>
          </form>
        </div>
      </div>
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
