// /src/app/achievements/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

const SESSION_KEY = "qz_auth";

type AchResponse = {
  stats?: { streakDays?: number; totalLikes?: number; friendsCount?: number };
  unlocked?: string[];
  showcase?: string[]; // ordered, <= 8
};

type BadgeCategory =
  | "Streaks"
  | "Duels"
  | "Progress"
  | "Milestones"
  | "Profile"
  | "Popularity";

type Badge = {
  key: string;
  title: string;
  desc: string;     // concise description
  iconSrc: string;  // .svg or .png
  category: BadgeCategory;
};

const ALL_BADGES: Badge[] = [
  // ---- Streaks ----
  { key: "rookie-streaker",      title: "Rookie Streaker",      desc: "Study 3 days in a row.",              iconSrc: "/badges/rookie-streaker.svg",      category: "Streaks" },
  { key: "weekly-warrior",       title: "Weekly Warrior",       desc: "Study 7 days in a row.",              iconSrc: "/badges/weekly-warrior.svg",       category: "Streaks" },
  { key: "fortnight-focus",      title: "Fortnight Focus",      desc: "Study 14 days in a row.",             iconSrc: "/badges/fortnight-focus.svg",      category: "Streaks" },
  { key: "one-month-marathoner", title: "One-Month Marathoner", desc: "Achieve a 30-day study streak.",      iconSrc: "/badges/one-month-marathoner.svg", category: "Streaks" },
  { key: "unstoppable",          title: "Unstoppable",          desc: "Achieve a 100-day study streak.",     iconSrc: "/badges/unstoppable.svg",          category: "Streaks" },
  { key: "yearly-legend",        title: "Yearly Legend",        desc: "Achieve a 365-day study streak.",     iconSrc: "/badges/yearly-legend.svg",        category: "Streaks" },
  { key: "night-owl",            title: "Night Owl",            desc: "Study late at night.",                iconSrc: "/badges/night-owl.svg",            category: "Streaks" },
  { key: "early-bird",           title: "Early Bird",           desc: "Study early in the morning.",         iconSrc: "/badges/early-bird.svg",           category: "Streaks" },

  // ---- Duels ----
  { key: "first-blood",          title: "First Blood",          desc: "Win your first duel.",                iconSrc: "/badges/first-blood.svg",          category: "Duels" },
  { key: "comeback-kid",         title: "Comeback Kid",         desc: "Win a duel after trailing.",          iconSrc: "/badges/comeback-kid.svg",         category: "Duels" },
  { key: "flawless-victory",     title: "Flawless Victory",     desc: "Win with no mistakes.",               iconSrc: "/badges/flawless-victory.svg",     category: "Duels" },
  { key: "duelist-apprentice",   title: "Duelist Apprentice",   desc: "Win 5 duels.",                        iconSrc: "/badges/duelist-apprentice.svg",   category: "Duels" },
  { key: "arena-champion",       title: "Arena Champion",       desc: "Win 20 duels.",                       iconSrc: "/badges/arena-champion.svg",       category: "Duels" },
  { key: "legend-of-the-arena",  title: "Legend of the Arena",  desc: "Win 100 duels.",                      iconSrc: "/badges/legend-of-the-arena.svg",  category: "Duels" },
  { key: "friendly-fire",        title: "Friendly Fire",        desc: "Duel with a friend.",                 iconSrc: "/badges/friendly-fire.svg",        category: "Duels" },

  // ---- Study Progress ----
  { key: "getting-started",      title: "Getting Started",      desc: "Complete your first study session.",  iconSrc: "/badges/getting-started.svg",      category: "Progress" },
  { key: "quiz-master",          title: "Quiz Master",          desc: "Get a perfect quiz score.",           iconSrc: "/badges/quiz-master.svg",          category: "Progress" },
  { key: "perfectionist",        title: "Perfectionist",        desc: "Achieve 10 perfect runs.",            iconSrc: "/badges/perfectionist.svg",        category: "Progress" },
  { key: "flashcard-fanatic",    title: "Flashcard Fanatic",    desc: "Review 500 flashcards.",              iconSrc: "/badges/flashcard-fanatic.svg",    category: "Progress" },
  { key: "set-explorer",         title: "Set Explorer",         desc: "Study 10 different sets.",            iconSrc: "/badges/set-explorer.svg",         category: "Progress" },
  { key: "library-builder",      title: "Library Builder",      desc: "Create 5 study sets.",                iconSrc: "/badges/library-builder.svg",      category: "Progress" },
  { key: "scholar",              title: "Scholar",              desc: "Study for 10 hours.",                 iconSrc: "/badges/scholar.svg",              category: "Progress" },
  { key: "sage",                 title: "Sage",                 desc: "Study for 50 hours.",                 iconSrc: "/badges/sage.svg",                 category: "Progress" },

  // ---- Milestones ----
  { key: "first-set-conqueror", title: "First Set Conqueror", desc: "Finish your first set.",                iconSrc: "/badges/first-set-conqueror.svg", category: "Milestones" },
  { key: "collector",            title: "Collector",            desc: "Unlock 10 badges.",                   iconSrc: "/badges/collector.svg",            category: "Milestones" },
  { key: "achievement-hunter",   title: "Achievement Hunter",   desc: "Unlock 25 badges.",                   iconSrc: "/badges/achievement-hunter.svg",   category: "Milestones" },
  { key: "badge-master",         title: "Badge Master",         desc: "Unlock 50 badges.",                   iconSrc: "/badges/badge-master.svg",         category: "Milestones" },
  { key: "legendary-scholar",    title: "Legendary Scholar",    desc: "Unlock all badges.",                  iconSrc: "/badges/legendary-scholar.svg",    category: "Milestones" },

  // ---- Profile ----
  { key: "first-steps",          title: "First Steps",          desc: "Create your profile.",                iconSrc: "/badges/first-steps.svg",          category: "Profile" },
  { key: "style-setter",         title: "Style Setter",         desc: "Customize avatar or theme.",          iconSrc: "/badges/style-setter.svg",         category: "Profile" },
  { key: "social-learner",       title: "Social Learner",       desc: "Share a set or badge.",               iconSrc: "/badges/social-learner.svg",       category: "Profile" },
  { key: "supporter",            title: "Supporter",            desc: "Give 10 likes.",                      iconSrc: "/badges/supporter.svg",            category: "Profile" },

  // ---- Popularity ----
  { key: "rising-star",          title: "Rising Star",          desc: "Reach 10 likes on a set.",            iconSrc: "/badges/rising-star.svg",          category: "Popularity" },
  { key: "trendsetter",          title: "Trendsetter",          desc: "Reach 50 likes on a set.",            iconSrc: "/badges/trendsetter.svg",          category: "Popularity" },
  { key: "legendary-creator",    title: "Legendary Creator",    desc: "Reach 100 likes on a set.",           iconSrc: "/badges/legendary-creator.svg",    category: "Popularity" },
];

export default function AchievementsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  // session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const u = raw ? JSON.parse(raw) : null;
      if (!u?.id) throw new Error("no id");
      setUserId(u.id);
    } catch {
      setErr("Please sign in.");
      setLoading(false);
    }
  }, []);

  // load data
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/achievements/me?userId=${encodeURIComponent(userId)}`);
        const js: AchResponse = await res.json();
        if (!res.ok) throw new Error((js as any)?.error || "Failed to load achievements.");
        setUnlocked(new Set(Array.isArray(js.unlocked) ? js.unlocked : []));
        setPicks(Array.isArray(js.showcase) ? js.showcase.slice(0, 8) : []);
      } catch (e: any) {
        setErr(e?.message || "Network error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const grouped = useMemo(() => {
    const groups: Record<BadgeCategory, Badge[]> = {
      Streaks: [],
      Duels: [],
      Progress: [],
      Milestones: [],
      Profile: [],
      Popularity: [],
    };
    for (const b of ALL_BADGES) groups[b.category].push(b);
    return groups;
  }, []);

  const togglePick = (key: string) => {
    if (!unlocked.has(key)) return;
    setPicks((prev) => {
      if (prev.includes(key)) {
        setDirty(true);
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= 8) return prev;
      setDirty(true);
      return [...prev, key];
    });
  };
  const isPicked = (key: string) => picks.includes(key);

  const save = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/achievements/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, badgeKeys: picks }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.error || "Failed to save showcase.");
      setDirty(false);
      alert("Showcase saved.");
    } catch (e: any) {
      alert(e?.message || "Network error.");
    }
  };

  // unified sizing
  const CARD_H = 160;
  const ICON = { base: "h-16 w-16", md: "md:h-20 md:w-20" };

  return (
    <>
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">Loading…</div>
      ) : err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{err}</div>
      ) : (
        <div className="space-y-6 text-white">
          {/* Header / actions */}
          <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Achievements</h1>
                <p className="text-sm text-white/70">Choose up to 8 badges to showcase on your profile.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-white/80">
                  Showcase: <span className="font-semibold">{picks.length}</span>/8
                </div>
                <button
                  type="button"
                  disabled={!dirty}
                  onClick={save}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    dirty
                      ? "bg-[var(--brand)] text-[var(--btn-contrast)] hover:brightness-110"
                      : "bg-white/10 text-white/70 cursor-not-allowed"
                  }`}
                >
                  Save showcase
                </button>
              </div>
            </div>
          </section>

          {/* Groups */}
          {(
            [
              ["Streaks", grouped.Streaks] as const,
              ["Progress", grouped.Progress] as const,
              ["Popularity", grouped.Popularity] as const,
              ["Duels", grouped.Duels] as const,
              ["Milestones", grouped.Milestones] as const,
              ["Profile", grouped.Profile] as const,
            ] satisfies ReadonlyArray<readonly [BadgeCategory, Badge[]]>
          ).map(([title, items]) => (
            <section key={title} className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{title}</h2>
                <span className="text-xs text-white/60">
                  {items.filter((b) => unlocked.has(b.key)).length}/{items.length} unlocked
                </span>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map((b) => {
                  const isUnlocked = unlocked.has(b.key);
                  const picked = isPicked(b.key);
                  return (
                    <li key={b.key}>
                      <button
                        type="button"
                        onClick={() => togglePick(b.key)}
                        aria-pressed={picked}
                        className={`group relative block w-full rounded-2xl border border-white/10 transition
                          ${isUnlocked ? "hover:bg-white/[0.07]" : "opacity-70 cursor-default"}
                          ${picked ? "ring-2 ring-[var(--brand)]" : ""}`}
                        style={{ height: CARD_H }}
                      >
                        {/* Grid aligns content tighter and keeps a bottom gap */}
                        <div className="grid h-full w-full grid-rows-[auto_auto_1fr_auto] items-center justify-items-center gap-1.5 px-4 pt-2 pb-3 text-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={b.iconSrc}
                            alt={b.title}
                            className={`${ICON.base} ${ICON.md} object-contain select-none ${isUnlocked ? "" : "grayscale"} -mt-1`}
                            draggable={false}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              if (!img.dataset.fallback) {
                                img.dataset.fallback = "1";
                                img.src = b.iconSrc.replace(/\.svg$/i, ".png");
                              }
                            }}
                          />
                          <div className="text-sm font-bold leading-tight line-clamp-1">{b.title}</div>
                          <div className="text-xs text-white/75 leading-snug line-clamp-2">{b.desc}</div>
                          <div className="text-[11px] font-semibold">
                            {isUnlocked ? (
                              picked ? <span className="text-[var(--brand)]">Showcased</span> : <span className="text-white/80">Unlocked</span>
                            ) : (
                              <span className="text-white/60">Locked</span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
