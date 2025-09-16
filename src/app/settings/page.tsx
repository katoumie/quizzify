"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";

const SESSION_KEY = "qz_auth";

// Built-in avatar options from /public/icons
const BUILTIN_ICONS = [
  "/icons/starfish.png",
  "/icons/love.png",
  "/icons/shell.png",
  "/icons/horse.png",
  "/icons/chick.png",
  "/icons/fish.png",
  "/icons/rabbit.png",
  "/icons/pig.png",
  "/icons/cat.png",
] as const;

// Validation helpers
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "STUDENT" | "TEACHER" | "ADMIN";

type SessionUser = {
  id: string;
  email: string;
  username?: string | null;
  createdAt?: string;
  avatar?: string | null; // DB: URL or data URL
  role?: Role | null;
};

export default function SettingsPage() {
  const [session, setSession] = useState<SessionUser | null>(null);

  // ------- Avatar state -------
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ------- Profile (username/email) state -------
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  // ------- Password state (optional; wire when API exists) -------
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  // ------- Role (teacher toggle) state -------
  const [role, setRole] = useState<Role>("STUDENT");
  const [roleDirty, setRoleDirty] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleOk, setRoleOk] = useState<string | null>(null);

  // Load session from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SessionUser;
      setSession(parsed);
      setPendingAvatar(parsed.avatar ?? null);
      setUsername(parsed.username ?? "");
      setEmail(parsed.email ?? "");
      setRole((parsed.role as Role) ?? "STUDENT");
    } catch {
      // ignore
    }
  }, []);

  // Track when profile form is actually dirty vs session
  useEffect(() => {
    if (!session) return;
    const dirty = (session.username ?? "") !== username || (session.email ?? "") !== email;
    setProfileDirty(dirty);
  }, [session, username, email]);

  // Track role dirty vs session
  useEffect(() => {
    if (!session) return;
    setRoleDirty((session.role ?? "STUDENT") !== role);
  }, [session, role]);

  // Is this a Perpetual account? (for subtle accents if you want)
  const isPerpetual = useMemo(
    () => (email || session?.email || "").toLowerCase().endsWith("@perpetual.edu.ph"),
    [email, session?.email]
  );

  // ---------- UI helpers ----------
  const openFile = () => fileInputRef.current?.click();

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingAvatar(dataUrl);
      setAvatarDirty(true);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const onPickBuiltin = (src: string) => {
    setPendingAvatar(src);
    setAvatarDirty(true);
  };

  // Apply theme instantly when email changes (avoid flashing)
  function applyThemeForEmail(nextEmail: string) {
    const isP = nextEmail.toLowerCase().endsWith("@perpetual.edu.ph");
    const root = document.documentElement;
    root.classList.remove("theme-default", "theme-perpetual");
    root.classList.add(isP ? "theme-perpetual" : "theme-default");
  }

  // ---------- Save avatar ----------
  const onSaveAvatar = async () => {
    if (!session?.id) return;
    setSavingAvatar(true);
    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, avatar: pendingAvatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to update profile photo");
        setSavingAvatar(false);
        return;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event("qz:session-updated"));
      setSession(data.user);
      setAvatarDirty(false);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const onResetAvatar = async () => {
    if (!session?.id) return;
    setSavingAvatar(true);
    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, avatar: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to reset avatar");
        setSavingAvatar(false);
        return;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event("qz:session-updated"));
      setSession(data.user);
      setPendingAvatar(null);
      setAvatarDirty(false);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingAvatar(false);
    }
  };

  // ---------- Save username/email ----------
  const onSaveProfile = async () => {
    setProfileError(null);
    setProfileOk(null);
    if (!session?.id) return;

    const u = username.trim();
    const em = email.trim().toLowerCase();

    if (!USERNAME_REGEX.test(u)) {
      setProfileError(
        "Username must be 3–20 chars, start with a letter, and use letters, numbers, or underscores only."
      );
      return;
    }
    if (!EMAIL_REGEX.test(em)) {
      setProfileError("Please enter a valid email.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, username: u, email: em }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data?.error || "Failed to update account details.");
        setSavingProfile(false);
        return;
      }
      // Persist & notify shell/theme
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event("qz:session-updated"));
      applyThemeForEmail(data.user.email || em);
      setSession(data.user);
      setProfileOk("Saved!");
    } catch {
      setProfileError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------- Change password (requires /api/user/change-password) ----------
  const onChangePassword = async () => {
    setPwError(null);
    setPwOk(null);
    if (!session?.id) return;

    if (!currentPw || !newPw) {
      setPwError("Please fill out all password fields.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }

    setSavingPw(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data?.error || "Failed to change password.");
        setSavingPw(false);
        return;
      }
      setPwOk("Password updated.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setSavingPw(false);
    }
  };

  // ---------- Save role (teacher toggle) ----------
  const onSaveRole = async () => {
    if (!session?.id) return;
    setRoleError(null);
    setRoleOk(null);
    setSavingRole(true);
    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoleError(data?.error || "Failed to update role.");
        return;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event("qz:session-updated"));
      setSession(data.user);
      setRoleOk("Saved!");
    } catch {
      setRoleError("Network error. Please try again.");
    } finally {
      setSavingRole(false);
    }
  };

  const avatarPreview = pendingAvatar ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ===== Profile photo ===== */}
        <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            {/* Big preview */}
            <div className="relative self-center md:self-auto">
              <div className="h-40 w-40 rounded-full bg-white/10 grid place-items-center overflow-hidden ring-2 ring-white/10">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold">
                    {(session?.username ?? session?.email ?? "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Floating + button (upload) */}
              <button
                type="button"
                onClick={openFile}
                className="absolute -bottom-2 -right-2 h-11 w-11 rounded-full grid place-items-center text-black shadow
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                style={{ backgroundColor: "var(--brand)" }}
                aria-label="Upload new profile photo"
                title="Upload photo"
              >
                <SvgFileIcon src="/icons/add_24.svg" className="h-[18px] w-[18px]" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>

            {/* Pickers */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Profile picture</h2>
              <p className="text-sm text-white/70">Upload your own image or choose one of our defaults.</p>

              <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-8 md:grid-cols-9">
                {BUILTIN_ICONS.map((src) => {
                  const active = pendingAvatar === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => onPickBuiltin(src)}
                      className={`relative aspect-square rounded-full overflow-hidden ring-2 transition ${
                        active ? "ring-[var(--brand)]" : "ring-white/10 hover:ring-white/30"
                      }`}
                      title="Choose avatar"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onSaveAvatar}
                  disabled={!avatarDirty || savingAvatar}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--btn-contrast)] disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  {savingAvatar ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={onResetAvatar}
                  disabled={savingAvatar}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                >
                  Reset to initials
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Account details (username & email) ===== */}
        <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
          <h2 className="text-lg font-semibold">Account details</h2>
          <p className="text-sm text-white/70">Update your username and email address.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm block mb-1">Username</label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setProfileOk(null);
                }}
                placeholder="username"
              />
              <p className="text-xs text-white/60 mt-1">
                3–20 chars, start with a letter; letters, numbers, or underscores.
              </p>
            </div>

            <div>
              <label className="text-sm block mb-1">Email</label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setProfileOk(null);
                }}
                placeholder="you@example.com"
              />
              <p className="text-xs text-white/60 mt-1">
                Changing your school email will also change your theme.
              </p>
            </div>
          </div>

          {profileError && <p className="text-sm text-red-300 mt-3">{profileError}</p>}
          {profileOk && <p className="text-sm text-green-300 mt-3">{profileOk}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveProfile}
              disabled={!profileDirty || savingProfile}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--btn-contrast)] disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {savingProfile ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername(session?.username ?? "");
                setEmail(session?.email ?? "");
                setProfileError(null);
                setProfileOk(null);
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </section>

        {/* ===== Educator role ===== */}
        <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
          <h2 className="text-lg font-semibold">Educator role</h2>
          <p className="text-sm text-white/70">
            Toggle the teacher role to unlock educator features (e.g., managing sets for classes).
          </p>

          <div className="mt-4 flex items-center justify-between gap-4 select-none">
            <div className="min-w-0">
              <label className="text-sm text-white/90">I am a teacher</label>
              <p className="text-xs text-white/60">Enable educator features for this account.</p>
            </div>

            <Toggle
              checked={role === "TEACHER"}
              onChange={(next) => {
                setRole(next ? "TEACHER" : "STUDENT");
                setRoleOk(null);
              }}
              ariaLabel="Toggle teacher role"
            />
          </div>

          {roleError && <p className="text-sm text-red-300 mt-3">{roleError}</p>}
          {roleOk && <p className="text-sm text-green-300 mt-3">{roleOk}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSaveRole}
              disabled={!roleDirty || savingRole}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--btn-contrast)] disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {savingRole ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRole((session?.role as Role) ?? "STUDENT");
                setRoleError(null);
                setRoleOk(null);
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </section>

        {/* ===== Change password (optional) ===== */}
        <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="text-sm text-white/70">Enter your current password, then choose a new one.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm block mb-1">Current password</label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-sm block mb-1">New password</label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Confirm new password</label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-white/10 outline-none placeholder:text-white/40 ring-1 ring-white/10 focus:ring-2 focus:ring-[var(--brand)]"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>

          {pwError && <p className="text-sm text-red-300 mt-3">{pwError}</p>}
          {pwOk && <p className="text-sm text-green-300 mt-3">{pwOk}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onChangePassword}
              disabled={savingPw}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--btn-contrast)] disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {savingPw ? "Updating..." : "Update password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
                setPwError(null);
                setPwOk(null);
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ========= File-based SVG icon (tints via currentColor) ========= */
function SvgFileIcon({ src, className = "" }: { src: string; className?: string }) {
  const imageUrl = `url(${src})`;
  return (
    <span
      aria-hidden="true"
      className={`block ${className}`}
      style={{
        WebkitMaskImage: imageUrl,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: imageUrl,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        backgroundColor: "currentColor",
      }}
    />
  );
}

/* ========= Toggle component ========= */
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
