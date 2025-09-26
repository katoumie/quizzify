// /src/app/(main)/sets/[id]/statistics/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, XAxis, YAxis, CartesianGrid, Bar
} from "recharts";

type SkillStat = {
  skillId: string;
  skillName: string;
  pKnow: number;              // 0..1
  masteryAchieved: boolean;   // >= 0.95
  nextReviewAt: string | null;
  correct7: number;
  wrong7: number;
};

type StatsPayload = {
  skills: SkillStat[];
  totals: {
    skills: number;
    mastered: number;
    nextDueAt: string | null; // next recommended review (soonest)
  };
};

type ItemStat = {
  cardId: string;
  term: string;
  skillName: string;
  pKnow: number;            // 0..1
  lastSeenAt: string | null;
  nextReviewAt: string;     // ISO
  correct7: number;
  wrong7: number;
};

type ItemStatsPayload = { items: ItemStat[] };

function getUserId(): string | null {
  try {
    const raw = localStorage.getItem("qz_auth");
    if (!raw) return null;
    const js = JSON.parse(raw);
    return typeof js?.id === "string" ? js.id : null;
  } catch { return null; }
}

function pct(n: number) {
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}
function shortDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function trunc(s: string, n = 36) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function SetStatisticsPage() {
  const { id: setId } = useParams<{ id: string }>();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [items, setItems] = useState<ItemStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const userId = getUserId();
        const [resSkills, resItems] = await Promise.all([
          fetch(`/api/sets/${setId}/stats?userId=${encodeURIComponent(userId ?? "")}`, { cache: "no-store" }),
          fetch(`/api/sets/${setId}/item-stats?userId=${encodeURIComponent(userId ?? "")}`, { cache: "no-store" }),
        ]);
        const [jsSkills, jsItems] = await Promise.all([resSkills.json(), resItems.json()]);
        if (!cancel) {
          setStats(jsSkills as StatsPayload);
          setItems((jsItems as ItemStatsPayload)?.items ?? []);
        }
      } catch {
        if (!cancel) { setStats(null); setItems([]); }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [setId]);

  const mastered = stats?.skills.filter(s => s.masteryAchieved).length ?? 0;

  // Weak items (lowest pKnow first)
  const weakItems = useMemo(() => {
    return (items ?? [])
      .slice()
      .sort((a, b) => a.pKnow - b.pKnow)
      .slice(0, 10);
  }, [items]);

  // Chart dataset for per-item mastery (take up to 15 weakest)
  const itemChartData = useMemo(() => {
    const src = (items ?? [])
      .slice()
      .sort((a, b) => a.pKnow - b.pKnow)
      .slice(0, 15);
    return src.map(it => ({ name: trunc(it.term, 14), pKnow: Math.round(it.pKnow * 100) }));
  }, [items]);

  return (
    <main className="p-4">
      <h1 className="text-white text-xl font-semibold mb-3">Set Statistics</h1>

      {loading ? (
        <div className="text-white/80">Loading…</div>
      ) : !stats || stats.skills.length === 0 ? (
        <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-white/80">
          No data yet. Study this set to see your mastery.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Donut: mastered vs not */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">Mastery overview</div>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Mastered", value: mastered },
                      { name: "Learning", value: Math.max(0, (stats?.totals.skills ?? 0) - mastered) },
                    ]}
                    innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#a78bfa" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-white/80 text-sm mt-2">
              {mastered} / {stats?.totals.skills} skills mastered.
            </div>
          </div>

          {/* Bar: p(Know) per skill */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">Skill mastery (pKnow)</div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={stats.skills.map(s => ({ name: s.skillName, pKnow: Math.round(s.pKnow * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="#fff" fontSize={12} />
                  <YAxis stroke="#fff" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="pKnow" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weak items (lowest pKnow) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">Weak items (lowest pKnow)</div>

            {(!items || items.length === 0) ? (
              <div className="text-white/70 text-sm">No per-item data yet.</div>
            ) : (
              <ul className="space-y-2">
                {weakItems.map((it) => (
                  <li
                    key={it.cardId}
                    className="rounded-lg bg-white/5 ring-1 ring-white/10 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">{it.term}</div>
                        <div className="text-white/60 text-xs">
                          Skill: <span className="text-white/80">{it.skillName}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/80">pKnow</div>
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

                    {/* Mini footer: recent accuracy + due */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/70">
                      <span>7d: <span className="text-white/85">{it.correct7}</span>✓ / <span className="text-white/85">{it.wrong7}</span>✗</span>
                      <span>Last seen: <span className="text-white/85">{shortDate(it.lastSeenAt)}</span></span>
                      <span>Next review: <span className="text-white/85">{shortDate(it.nextReviewAt)}</span></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Per-item mastery chart (weakest 15) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/90 font-medium mb-2">Per-item mastery (weakest 15)</div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={itemChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="#fff" fontSize={12} />
                  <YAxis stroke="#fff" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="pKnow" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming reviews (skills) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
            <div className="text-white/90 font-medium mb-2">Next recommended reviews (by skill)</div>
            <ul className="space-y-1 text-white/85 text-sm">
              {stats.skills
                .filter(s => s.nextReviewAt)
                .sort((a, b) => +new Date(a.nextReviewAt!) - +new Date(b.nextReviewAt!))
                .slice(0, 10)
                .map(s => (
                  <li key={s.skillId} className="flex items-center justify-between">
                    <span>{s.skillName}</span>
                    <span className="text-white/70">{new Date(s.nextReviewAt!).toLocaleString()}</span>
                  </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
