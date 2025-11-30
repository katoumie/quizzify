// /src/app/(main)/sets/[id]/statistics/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
} from "recharts";

/* ── Types ─────────────────────────────────────────────────────────────── */
type SkillStat = {
  skillId: string;
  skillName: string;
  pKnow: number; // 0..1 (per-user or averaged across class)
  masteryAchieved: boolean; // >= 0.95 (per-user or based on class rule)
  nextReviewAt: string | null;
  correct7: number;
  wrong7: number;
};
type StatsPayload = {
  skills: SkillStat[];
  totals: {
    skills: number;
    mastered: number; // per-user: count of mastered skills; class: can be derived server-side if you like
    nextDueAt: string | null;
    avgMasteryPct?: number; // 0..1 — average % of mastered skills across students (class view)
    studentCount?: number; // number of students included in the aggregate (class view)
  };
};

type ItemStat = {
  cardId: string;
  term: string;
  skillName: string;
  pKnow: number; // 0..1 (per-user or averaged across class)
  lastSeenAt: string | null;
  nextReviewAt: string; // ISO
  correct7: number;
  wrong7: number;
};
type ItemStatsPayload = { items: ItemStat[] };

/* ── Utils ─────────────────────────────────────────────────────────────── */
function getSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem("qz_auth");
    if (!raw) return null;
    const js = JSON.parse(raw);
    return typeof js?.id === "string" ? js.id : null;
  } catch {
    return null;
  }
}
const pct = (n: number) => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function SetStatisticsPage() {
  const { id: setId } = useParams<{ id: string }>();
  const search = useSearchParams();

  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"user" | "class">("user");
  const [classId, setClassId] = useState<string | null>(null);

  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [items, setItems] = useState<ItemStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve what we are viewing:
  // - if ?classId= is present → class aggregate
  // - else ?userId= or current session user
  useEffect(() => {
    const qClass = (search.get("classId") || "").trim() || null;
    const qUser = (search.get("userId") || "").trim() || null;
    const sess = getSessionUserId();
    setSessionUserId(sess);

    if (qClass) {
      setViewMode("class");
      setClassId(qClass);
      setEffectiveUserId(null);
    } else {
      setViewMode("user");
      setClassId(null);
      setEffectiveUserId(qUser ?? sess ?? null);
    }
  }, [search]);

  useEffect(() => {
    if (!setId) return;

    let cancel = false;

    (async () => {
      if (viewMode === "user") {
        if (!effectiveUserId) return;
        setLoading(true);
        try {
          const [resSkills, resItems] = await Promise.all([
            fetch(`/api/sets/${setId}/stats?userId=${encodeURIComponent(effectiveUserId)}`, {
              cache: "no-store",
            }),
            fetch(`/api/sets/${setId}/item-stats?userId=${encodeURIComponent(effectiveUserId)}`, {
              cache: "no-store",
            }),
          ]);
          const [jsSkills, jsItems] = await Promise.all([resSkills.json(), resItems.json()]);
          if (!cancel) {
            setStats(jsSkills as StatsPayload);
            setItems((jsItems as ItemStatsPayload)?.items ?? []);
          }
        } catch {
          if (!cancel) {
            setStats(null);
            setItems([]);
          }
        } finally {
          if (!cancel) setLoading(false);
        }
      } else if (viewMode === "class" && classId) {
        setLoading(true);
        try {
          const [resSkills, resItems] = await Promise.all([
            fetch(`/api/classes/${encodeURIComponent(classId)}/sets/${setId}/stats`, {
              cache: "no-store",
            }),
            fetch(`/api/classes/${encodeURIComponent(classId)}/sets/${setId}/item-stats`, {
              cache: "no-store",
            }),
          ]);
          const [jsSkills, jsItems] = await Promise.all([resSkills.json(), resItems.json()]);
          if (!cancel) {
            setStats(jsSkills as StatsPayload);
            setItems((jsItems as ItemStatsPayload)?.items ?? []);
          }
        } catch {
          if (!cancel) {
            setStats(null);
            setItems([]);
          }
        } finally {
          if (!cancel) setLoading(false);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [setId, effectiveUserId, viewMode, classId]);

  const mastered = stats?.skills.filter((s) => s.masteryAchieved).length ?? 0;

  // Average mastery % across students (class view) or fallback per-user ratio
  const avgMasteryValue = stats?.totals
    ? typeof stats.totals.avgMasteryPct === "number"
      ? Math.max(0, Math.min(1, stats.totals.avgMasteryPct))
      : stats.totals.skills
      ? mastered / stats.totals.skills
      : 0
    : 0;

  // Weak items (lowest pKnow first)
  const weakItems = useMemo(
    () => (items ?? []).slice().sort((a, b) => a.pKnow - b.pKnow).slice(0, 10),
    [items]
  );

  // Per-item chart data (weakest 15). We hide x-axis labels; show in tooltip.
  const itemChartData = useMemo(() => {
    const src = (items ?? []).slice().sort((a, b) => a.pKnow - b.pKnow).slice(0, 15);
    return src.map((it) => ({ label: it.term, pKnow: Math.round(it.pKnow * 100) }));
  }, [items]);

  // Skill chart data. Hide x-axis labels; show in tooltip.
  const skillChartData = useMemo(
    () => (stats?.skills ?? []).map((s) => ({ label: s.skillName, pKnow: Math.round(s.pKnow * 100) })),
    [stats]
  );

  // Due forecast (next 14 days) — bin by local calendar day
  const dueBins = useMemo(() => {
    const DAY = 86_400_000;

    // start-of-today (local)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    // build 14 daily buckets with calendar labels
    const bins = Array.from({ length: 14 }, (_, i) => ({
      dayIdx: i,
      label: new Date(todayStart + i * DAY).toLocaleDateString(),
      count: 0,
    }));

    for (const it of items ?? []) {
      if (!it.nextReviewAt) continue;
      const due = new Date(it.nextReviewAt);
      if (isNaN(+due)) continue;

      // snap due to its calendar day (local)
      due.setHours(0, 0, 0, 0);
      const d = Math.floor((+due - todayStart) / DAY);

      if (d >= 0 && d < bins.length) bins[d].count += 1;
    }
    return bins;
  }, [items]);

  const viewingOthers =
    viewMode === "user" && effectiveUserId && sessionUserId && effectiveUserId !== sessionUserId;
  const viewingClass = viewMode === "class" && !!classId;

  const masteryTitle = viewMode === "class" ? "Class mastery overview" : "Mastery overview";

  const masteryDonutData =
    viewMode === "class"
      ? [
          { name: "Average mastered", value: Math.round(avgMasteryValue * 100) },
          { name: "Remaining", value: Math.max(0, 100 - Math.round(avgMasteryValue * 100)) },
        ]
      : [
          { name: "Mastered", value: mastered },
          { name: "Learning", value: Math.max(0, (stats?.totals.skills ?? 0) - mastered) },
        ];

  return (
    <main className="p-4">
      {/* dark, rounded scrollbar for our scroll containers */}
      <style jsx global>{`
        .qz-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .qz-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }
        .qz-scroll::-webkit-scrollbar-thumb {
          background: rgba(168, 177, 255, 0.35);
          border-radius: 12px;
        }
        .qz-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 177, 255, 0.55);
        }
        .qz-scroll {
          scrollbar-color: rgba(168, 177, 255, 0.45) rgba(255, 255, 255, 0.06);
          scrollbar-width: thin;
        }
      `}</style>

      <h1 className="text-white text-xl font-semibold mb-3">Set Statistics</h1>

      {viewingOthers && (
        <div className="mb-3 text-xs text-white/80">
          Viewing statistics for{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 ring-1 ring-white/10">
            {effectiveUserId}
          </code>
        </div>
      )}

      {viewingClass && (
        <div className="mb-3 text-xs text-white/80">
          Viewing class statistics for this set (all enrolled students).
        </div>
      )}

      {loading ? (
        <div className="text-white/80">Loading…</div>
      ) : !stats || stats.skills.length === 0 ? (
        <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-white/80">
          No data yet. Study this set to see mastery.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Donut: mastery overview */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">{masteryTitle}</div>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={masteryDonutData}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#a78bfa" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1b1230",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#fff" }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-white/80 text-sm mt-2">
              {viewMode === "class" ? (
                <>
                  Average mastery: {Math.round(avgMasteryValue * 100)}% of skills across{" "}
                  {typeof stats.totals.studentCount === "number"
                    ? `${stats.totals.studentCount} students`
                    : "the class"}
                  .
                </>
              ) : (
                <>
                  {mastered} / {stats.totals.skills} skills mastered.
                </>
              )}
            </div>
          </div>

          {/* Skill pKnow (hide x labels; show in tooltip) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">
              {viewMode === "class" ? "Skill mastery (average pKnow)" : "Skill mastery (pKnow)"}
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={skillChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" hide />
                  <YAxis stroke="#fff" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    formatter={(v: number) => [
                      `${v}%`,
                      viewMode === "class" ? "Average pKnow" : "pKnow",
                    ]}
                    labelFormatter={(l: string) => l}
                    contentStyle={{
                      background: "#1b1230",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  />
                  <Bar dataKey="pKnow" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weak items list (scroll) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:row-span-2">
            <div className="text-white/90 font-medium mb-2">
              Weak items (lowest {viewMode === "class" ? "average pKnow" : "pKnow"})
            </div>
            {!items || items.length === 0 ? (
              <div className="text-white/70 text-sm">No per-item data yet.</div>
            ) : (
              <ul className="qz-scroll max-h-[520px] overflow-auto space-y-2 pr-2">
                {weakItems.map((it) => (
                  <li key={it.cardId} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">{it.term}</div>
                        <div className="text-white/60 text-xs">
                          Skill: <span className="text-white/80">{it.skillName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/70">
                          {viewMode === "class" ? "Average pKnow" : "pKnow"}
                        </div>
                        <div className="text-white font-semibold">{pct(it.pKnow)}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.round(it.pKnow * 100)}%`,
                          background: "linear-gradient(90deg, #ef4444, #60a5fa)",
                        }}
                      />
                    </div>

                    {/* Mini footer */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/70">
                      <span>
                        7d: <span className="text-white/85">{it.correct7}</span>✓ /{" "}
                        <span className="text-white/85">{it.wrong7}</span>✗
                      </span>
                      <span>
                        Last seen:{" "}
                        <span className="text-white/85">{shortDate(it.lastSeenAt)}</span>
                      </span>
                      <span>
                        Next review:{" "}
                        <span className="text-white/85">{shortDate(it.nextReviewAt)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Per-item mastery chart (weakest 15) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">
              Per-item mastery (weakest 15)
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={itemChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" hide />
                  <YAxis stroke="#fff" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    formatter={(v: number) => [
                      `${v}%`,
                      viewMode === "class" ? "Average pKnow" : "pKnow",
                    ]}
                    labelFormatter={(l: string) => l}
                    contentStyle={{
                      background: "#1b1230",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  />
                  <Bar dataKey="pKnow" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Due forecast (next 14 days) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">
              {viewMode === "class"
                ? "Class due forecast (next 14 days)"
                : "Due forecast (next 14 days)"}
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={dueBins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" hide />
                  <YAxis stroke="#fff" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    formatter={(v: number) => [
                      v,
                      viewMode === "class" ? "Items due (all students)" : "Items due",
                    ]}
                    labelFormatter={(l: string) => l}
                    contentStyle={{
                      background: "#1b1230",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  />
                  <Bar dataKey="count" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-white/70">
              Hover bars to see date & number of items that become due.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
