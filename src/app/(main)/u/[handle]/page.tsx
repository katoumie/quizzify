// /src/app/u/[handle]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProfileCalendarLarge from "@/components/ProfileCalendarLarge";
import SetCard, { type SetCardData } from "@/components/SetCard";

const SESSION_KEY = "qz_auth";

type ProfileUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  avatar?: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  createdAt: string;
};

type ShowcaseBadge = {
  key: string;
  title: string;
  iconSrc: string;
};

type ProfilePayload = {
  user: ProfileUser;
  studiedDates?: string[];
  friendsCount?: number;
  streakDays?: number | null;
  totalLikes?: number;
  badgeShowcase?: ShowcaseBadge[];
  stats?: {
    friendsCount?: number;
    studiedDates?: string[];
    streakDays?: number;
    totalLikes?: number;
  };
  recentSets?: SetCardData[];
  recentClasses?: Array<{ id: string; title: string; createdAt: string }>;
};

export default function PublicProfilePage() {
  const router = useRouter();
  const { handle } = useParams<{ handle: string }>();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfilePayload | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) setViewerId(u.id);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
        const js: ProfilePayload | { error?: string } = await res.json();
        if (!res.ok) {
          setError((js as any)?.error || "Failed to load profile.");
          setLoading(false);
          return;
        }
        if (!alive) return;
        setData(js as ProfilePayload);
      } catch {
        if (alive) setError("Network error.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [handle]);

  const isOwner = useMemo(
    () => Boolean(viewerId && data?.user?.id && viewerId === data.user.id),
    [viewerId, data?.user?.id]
  );

  const joinedLabel = useMemo(() => {
    const d = data?.user?.createdAt ? new Date(data.user.createdAt) : null;
    return d ? d.toLocaleDateString() : "";
  }, [data?.user?.createdAt]);

  const studiedDates =
    Array.isArray(data?.studiedDates)
      ? data!.studiedDates!
      : Array.isArray(data?.stats?.studiedDates)
      ? data!.stats!.studiedDates!
      : [];

  const friendsCount =
    typeof data?.friendsCount === "number"
      ? data.friendsCount
      : typeof data?.stats?.friendsCount === "number"
      ? data.stats.friendsCount!
      : 0;

  const streakDays =
    typeof data?.streakDays === "number"
      ? data.streakDays
      : typeof data?.stats?.streakDays === "number"
      ? data.stats.streakDays!
      : null;

  const totalLikes =
    typeof data?.totalLikes === "number"
      ? data.totalLikes
      : typeof data?.stats?.totalLikes === "number"
      ? data.stats.totalLikes!
      : 0;

  const streakText =
    typeof streakDays === "number"
      ? `${streakDays} ${streakDays === 1 ? "day" : "days"}`
      : "—";

  const showcaseRaw = Array.isArray(data?.badgeShowcase) ? data!.badgeShowcase! : [];
  const showcase = showcaseRaw.slice(0, 8);
  const emptySlots = Math.max(0, 8 - showcase.length);

  return (
    <>
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">
          Profile not found.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero bar */}
          <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] px-6 py-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar src={data.user.avatar} alt={data.user.username || "User"} />
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h1 className="truncate text-2xl font-bold">
                      {data.user.username || "User"}
                    </h1>
                    <RolePill role={data.user.role} />
                  </div>
                  <div className="mt-1 text-sm text-white/80 truncate">
                    {data.user.email ?? ""}{data.user.email ? " • " : ""}Joined {joinedLabel}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  isOwner
                    ? router.push("/settings")
                    : alert("Friend requests coming soon")
                }
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold
                  ${
                    isOwner
                      ? "bg-white/10 ring-1 ring-white/15 hover:bg-white/14"
                      : "bg-[var(--brand)] text-[var(--btn-contrast)] hover:brightness-110"
                  }`}
              >
                <SvgMask src="/icons/profile_24.svg" className="h-4 w-4" />
                {isOwner ? "Edit profile" : "Add friend"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatTile label="Total likes" value={totalLikes.toLocaleString()} />
              <StatTile label="Friends" value={friendsCount.toLocaleString()} />
              <StatTile label="Current streak" value={streakText} />
            </div>
          </section>

          <ProfileCalendarLarge studiedDates={studiedDates} />

          {/* Badge Showcase */}
          <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Badge showcase</h2>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => router.push("/achievements")}
                  className="text-xs font-semibold text-white/80 hover:text-white"
                  title="Choose which 8 badges to showcase"
                >
                  Manage in Achievements →
                </button>
              )}
            </div>

            {showcase.length === 0 && !isOwner ? (
              <p className="text-sm text-white/70">No badges showcased yet.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {showcase.map((b) => (
                  <li
                    key={b.key}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.iconSrc}
                        alt={b.title}
                        className="h-16 w-16 md:h-20 md:w-20 object-contain select-none"
                        draggable={false}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-tight truncate">
                          {b.title}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}

                {isOwner &&
                  Array.from({ length: emptySlots }).map((_, i) => (
                    <li
                      key={`empty-${i}`}
                      className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-xs text-white/60 grid place-items-center"
                    >
                      Choose a badge in Achievements
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* Recent sets */}
          <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent sets</h2>
            </div>
            {!data.recentSets || data.recentSets.length === 0 ? (
              <p className="text-sm text-white/70">No sets yet.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.recentSets.map((s) => (
                  <li key={s.id}>
                    <SetCard
                      data={s}
                      isOwner={viewerId === s.owner?.id}
                      showActions={viewerId === s.owner?.id}
                      initiallyLiked={false}
                      onEdit={(id) => router.push(`/sets/${id}/edit`)}
                      onDelete={() => {}}
                      onToggleLike={() => {}}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent classes */}
          <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent classes</h2>
            </div>
            {!data.recentClasses || data.recentClasses.length === 0 ? (
              <p className="text-sm text-white/70">No classes yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.recentClasses.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="text-white font-medium">{c.title}</div>
                    <div className="text-xs text-white/60">
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/* Helpers */

function Avatar({ src, alt }: { src?: string | null; alt?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || "avatar"}
      className="h-14 w-14 rounded-full object-cover ring-1 ring-white/15"
    />
  ) : (
    <div className="h-14 w-14 rounded-full bg-white/10 ring-1 ring-white/15" />
  );
}

function RolePill({ role }: { role: "STUDENT" | "TEACHER" | "ADMIN" }) {
  const label =
    role === "TEACHER" ? "Teacher" : role === "STUDENT" ? "Student" : "Admin";
  return (
    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
      {label}
    </span>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs font-semibold text-white/70">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function SvgMask({ src, className = "" }: { src: string; className?: string }) {
  const url = `url(${src})`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${className}`}
      style={{
        WebkitMaskImage: url,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: url,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        backgroundColor: "currentColor",
      }}
    />
  );
}
