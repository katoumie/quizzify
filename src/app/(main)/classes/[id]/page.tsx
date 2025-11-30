// /src/app/(main)/classes/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
// Subnav is provided by AppShell
import AssignSetModal from "@/components/classes/AssignSetModal";
import { INPUT_BG } from "@/components/set-form/constants";
import { StaticSelect } from "@/components/library/StaticSelect";
import { StudyModal } from "@/components/library/StudyModal"; // ← ADD

type Role = "TEACHER" | "STUDENT";
type MemberRow = {
  userId: string;
  role: Role;
  joinedAt: string | Date;
  user: { id: string; username?: string | null; avatar?: string | null };
};

type ClassSetRow = {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  owner?: { id: string; username?: string | null; avatar?: string | null } | null;
  termCount?: number;
  likeCount?: number;
  assignedAt?: string | Date;
  dueAt?: string | Date | null;
  assignedBy?: { id: string; username?: string | null } | null;
};

const SESSION_KEY = "qz_auth";

type FilterKeySets = "all" | "mine";
type OrderKeySets = "updated" | "name" | "likes";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const search = useSearchParams();
  const tab = (search.get("tab") || "sets") as "sets" | "members";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const [sets, setSets] = useState<ClassSetRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [query, setQuery] = useState("");
  const [filterSets, setFilterSets] = useState<FilterKeySets>("all");
  const [orderSets, setOrderSets] = useState<OrderKeySets>("updated");

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);

  // Rename/delete modals
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Per-row "View set statistics" dropdown state (setId -> open?)
  const [statsOpenFor, setStatsOpenFor] = useState<string | null>(null);

  // STUDY MODAL (student view) ← ADD
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyTarget, setStudyTarget] = useState<{ id: string; title: string } | null>(null);

  // get session id for "mine" filter
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const js = JSON.parse(raw);
        setSessionUserId(js?.id ?? null);
      }
    } catch {}
  }, []);

  // fetch full detail
  const refreshClass = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/classes/${id}`, { cache: "no-store" });
      const js = await res.json();
      if (!res.ok) {
        setError(js?.error || "Failed to load class.");
        setLoading(false);
        return;
      }
      setName(js.name ?? "");
      setRole(js.role ?? null);
      setJoinCode(js.joinCode ?? null);
      setSets(js.sets ?? []);
      setMembers(js.members ?? []);
    } catch {
      setError("Network error while loading class.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // derived lists
  const filteredSets = useMemo(() => {
    let list = [...sets];

    if (filterSets === "mine" && sessionUserId) {
      list = list.filter((s) => s.owner?.id === sessionUserId);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.owner?.username ?? "").toLowerCase().includes(q)
      );
    }

    if (orderSets === "updated") {
      list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    } else if (orderSets === "likes") {
      list.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
    } else if (orderSets === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [sets, filterSets, orderSets, query, sessionUserId]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...members];
    if (q) {
      list = list.filter((m) => (m.user.username ?? "").toLowerCase().includes(q));
    }
    // teachers first
    list.sort((a, b) => {
      if (a.role === b.role) return (a.user.username ?? "").localeCompare(b.user.username ?? "");
      return a.role === "TEACHER" ? -1 : 1;
    });
    return list;
  }, [members, query]);

  const isTeacher = role === "TEACHER";

  // convenience: students only (for stats dropdown)
  const studentMembers = useMemo(
    () => members.filter((m) => m.role === "STUDENT"),
    [members]
  );

  // ==== STUDY helpers (student view) ← ADD
  const openStudy = (setId: string, title: string) => {
    setStudyTarget({ id: setId, title });
    setStudyOpen(true);
  };
  const closeStudy = () => {
    setStudyOpen(false);
    setStudyTarget(null);
  };
  const onPickStudy = async (
    mode: "learn" | "flashcards" | "duels",
    opts?: {
      difficulty?: "easy" | "medium" | "hard";
      mute?: boolean;
      scope?: "all" | "recommended";
      shuffle?: boolean;
      untimed?: boolean;
      duelsMode?: "ARENA" | "TEAM" | "STANDARD";
    }
  ) => {
    if (!studyTarget) return;

    if (mode === "flashcards") {
      const q = new URLSearchParams();
      q.set("difficulty", opts?.difficulty ?? "easy");
      if (opts?.mute) q.set("mute", "1");
      q.set("scope", opts?.scope ?? "all");
      if (opts?.shuffle) q.set("shuffle", "1");
      if (opts?.untimed) q.set("untimed", "1");
      const url = `/sets/${encodeURIComponent(studyTarget.id)}/flashcards?${q.toString()}`;
      closeStudy();
      router.push(url);
      return;
    }

    if (mode === "learn") {
      const url = `/sets/${encodeURIComponent(studyTarget.id)}/learn`;
      closeStudy();
      router.push(url);
      return;
    }

    if (mode === "duels") {
      try {
        const res = await fetch(`/api/duels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setId: studyTarget.id,
            mode: (opts?.duelsMode ?? "ARENA"),
            options: {},
            hostId: sessionUserId ?? undefined,
          }),
        });
        const js = await res.json().catch(() => ({} as any));
        if (!res.ok || !js?.code) throw new Error(js?.error || "Failed to create duels lobby.");
        closeStudy();
        router.push(`/duels/${js.code}`);
      } catch (e: any) {
        alert(e?.message || "Could not start Duels. Please try again.");
      }
    }
  };
  // ==== END STUDY helpers

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-white text-xl font-semibold truncate">{name || "Class"}</h1>

        {/* Right header cluster (teacher-only) */}
        <div className="flex items-center gap-2">
          {isTeacher && (
            <>
              <button
                type="button"
                onClick={() => {
                  setNewName(name);
                  setRenameOpen(true);
                }}
                className="h-7 px-2 rounded-[6px] text-white/90 hover:text-white text-[12px] bg-white/5 hover:bg-white/10 ring-1 ring-white/20"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="h-7 px-2 rounded-[6px] text-red-300 hover:text-red-200 text-[12px] bg-red-500/10 hover:bg-red-500/15 ring-1 ring-red-400/30"
              >
                Delete
              </button>
            </>
          )}

          {isTeacher && joinCode && (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span className="hidden sm:inline">Invite code:</span>
              <code className="rounded-md bg-white/5 ring-1 ring-white/15 px-2 py-1 text-white text-sm">
                {joinCode}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/classes/join/${joinCode}`)}
                className="h-7 px-2 rounded-[6px] text-white/90 hover:text-white text-[12px] bg-white/5 hover:bg-white/10 ring-1 ring-white/20"
              >
                Copy link
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search + controls align with Library */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {/* Search applies to active tab */}
        <div className="relative group grow min-w-[240px]">
          <img
            src="/icons/search.svg"
            alt=""
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-80"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "sets" ? "Find a set…" : "Find a member…"}
            autoComplete="off"
            className={[
              "no-native-clear",
              "w-full h-7 rounded-[6px] text-white placeholder-white/60 pl-7 pr-2.5 text-[12px]",
              "ring-1 ring-white/12",
              "group-focus-within:ring-[#a8b1ff]/80",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              "focus:outline-none",
            ].join(" ")}
            style={{ backgroundColor: INPUT_BG }}
            aria-label="Search"
          />
        </div>

        {/* Sets-only controls */}
        {tab === "sets" && (
          <>
            <StaticSelect
              label="Filter"
              value={filterSets}
              onChange={(v) => setFilterSets(v as FilterKeySets)}
              options={[
                { value: "all", label: "All" },
                { value: "mine", label: "Owned by me" },
              ]}
              size="sm"
            />
            <StaticSelect
              label="Sort"
              value={orderSets}
              onChange={(v) => setOrderSets(v as OrderKeySets)}
              options={[
                { value: "updated", label: "Last updated" },
                { value: "likes", label: "Likes" },
                { value: "name", label: "Name" },
              ]}
              size="sm"
            />
            {isTeacher && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-[6px]",
                  "h-7 px-2",
                  "text-white/90 hover:text-white text-[12px]",
                  "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                  "ring-1 ring-white/20 hover:ring-white/10",
                  "transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                ].join(" ")}
              >
                <img src="/icons/add.svg" alt="" className="h-[13px] w-[13px]" />
                <span className="font-medium">Assign set</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6 text-white/80">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
      ) : tab === "sets" ? (
        filteredSets.length === 0 ? (
          <p className="text-white/70 text-sm">No sets assigned to this class yet.</p>
        ) : (
          <ul role="list">
            {filteredSets.map((s) => {
              const updatedISO = s.updatedAt ?? s.createdAt;
              const setHref = isTeacher ? `/sets/${s.id}/edit` : `/sets/${s.id}`;
              return (
                <li key={s.id} className="px-1 py-3">
                  <div className="flex items-start justify-between gap-4">
                    {/* LEFT */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <a
                          href={setHref}
                          className="truncate text-[15px] font-semibold hover:underline"
                          style={{ color: "#41a7f8" }}
                          title={s.title}
                        >
                          {s.title}
                        </a>
                        <span className="text-xs text-white/60">
                          · {s.termCount ?? 0} terms · {s.likeCount ?? 0} likes
                        </span>
                      </div>

                      {/* Updated + assigned info */}
                      <div className="mt-1 mb-5 text-xs text-white/60">
                        <span title={new Date(updatedISO).toLocaleString()}>
                          Updated {timeAgo(String(updatedISO))}
                        </span>
                        {s.assignedBy?.username && (
                          <span className="ml-2">• assigned by {s.assignedBy.username}</span>
                        )}
                        {s.dueAt && (
                          <span className="ml-2">• due {new Date(s.dueAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      {/* Owner row */}
                      <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                        {s.owner?.avatar ? (
                          <img
                            src={s.owner.avatar}
                            alt=""
                            className="h-5 w-5 rounded-full ring-1 ring-white/15 object-cover"
                          />
                        ) : (
                          <span className="h-5 w-5 rounded-full ring-1 ring-white/15 bg-white/10 inline-block" />
                        )}
                        <a
                          href={s.owner?.username ? `/u/${s.owner.username}` : "#"}
                          className="text-white/85 hover:underline"
                        >
                          {s.owner?.username ?? "unknown"}
                        </a>
                      </div>
                    </div>

                    {/* RIGHT */}
                    {/* ★ allow wrapping + a tad more width so both buttons show */}
                    <div className="flex flex-wrap min-w-[260px] flex-row items-center justify-end gap-2 relative">
                      {isTeacher ? (
                        <>
                          {/* View set statistics dropdown (class + students) */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setStatsOpenFor((cur) => (cur === s.id ? null : s.id))}
                              className={[
                                "inline-flex items-center justify-center rounded-[6px]",
                                "h-7 px-3",
                                "text-white/90 hover:text-white text-[12px]",
                                "bg-white/5 hover:bg-white/10",
                                "ring-1 ring-white/20 hover:ring-white/10",
                                "transition-colors",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                              ].join(" ")}
                              aria-haspopup="listbox"
                              aria-expanded={statsOpenFor === s.id}
                            >
                              View set statistics
                              <img src="/icons/dropdown.svg" alt="" className="ml-1 h-3.5 w-3.5 opacity-80" />
                            </button>
                            <div
                              className={`absolute right-0 mt-1 w-[280px] overflow-hidden rounded-lg border border-white/15 shadow-lg z-[40] ${
                                statsOpenFor === s.id ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                              }`}
                              style={{ backgroundColor: "var(--bg, #18062e)", transition: "transform .12s, opacity .12s" }}
                              role="listbox"
                            >
                              <div className="p-2">
                                {studentMembers.length === 0 ? (
                                  <div className="px-2 py-2 text-sm text-white/60">No students yet.</div>
                                ) : (
                                  <>
                                    {/* Class-wide statistics option */}
                                    <button
                                      type="button"
                                      role="option"
                                      onClick={() => {
                                        setStatsOpenFor(null);
                                        router.push(
                                          `/sets/${encodeURIComponent(s.id)}/statistics?classId=${encodeURIComponent(
                                            String(id)
                                          )}`
                                        );
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm rounded-md text-white/90 hover:bg-white/10"
                                    >
                                      Class statistics (all students)
                                    </button>
                                    <div className="my-1 border-t border-white/10" />
                                    {/* Individual students */}
                                    {studentMembers.map((m) => (
                                      <button
                                        key={m.userId}
                                        role="option"
                                        onClick={() => {
                                          setStatsOpenFor(null);
                                          router.push(
                                            `/sets/${s.id}/statistics?userId=${encodeURIComponent(m.userId)}`
                                          );
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm rounded-md text-white/90 hover:bg-white/10"
                                      >
                                        {m.user.username ?? m.userId}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Remove from class */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Remove this set from the class? Students will no longer see it here.")) return;
                              try {
                                const res = await fetch(`/api/classes/${id}/sets/${s.id}`, { method: "DELETE" });
                                const js = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  alert(js?.error || "Failed to remove set.");
                                  return;
                                }
                                setSets((prev) => prev.filter((x) => x.id !== s.id));
                              } catch (e: any) {
                                alert(e?.message || "Network error.");
                              }
                            }}
                            className={[
                              "inline-flex items-center justify-center rounded-[6px]",
                              "h-7 px-3",
                              "text-white/90 hover:text-white text-[12px]",
                              "bg-white/5 hover:bg-white/10",
                              "ring-1 ring-white/20 hover:ring-white/10",
                              "transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                            ].join(" ")}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        // Student: Study button + View statistics (no dropdown)
                        <>
                          <button
                            type="button"
                            onClick={() => openStudy(s.id, s.title)}
                            className={[
                              "inline-flex items-center justify-center rounded-[6px]",
                              "h-7 px-3",
                              "text-white/90 hover:text-white text-[12px]",
                              "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                              "ring-1 ring-white/20 hover:ring-white/10",
                              "transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                            ].join(" ")}
                            data-testid="student-study-btn"
                          >
                            Study
                          </button>

                          <a
                            href={
                              sessionUserId
                                ? `/sets/${encodeURIComponent(s.id)}/statistics?userId=${encodeURIComponent(
                                    sessionUserId
                                  )}`
                                : `/sets/${encodeURIComponent(s.id)}/statistics`
                            }
                            className={[
                              "inline-flex items-center justify-center rounded-[6px]",
                              "h-7 px-3",
                              "text-white/90 hover:text-white text-[12px]",
                              "bg-white/5 hover:bg-white/10",
                              "ring-1 ring-white/20 hover:ring-white/10",
                              "transition-colors",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                            ].join(" ")}
                            title="View your statistics for this set"
                            data-testid="student-view-stats-btn"
                          >
                            View statistics
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 mb-0 border-b border-white/10" />
                </li>
              );
            })}
          </ul>
        )
      ) : (
        // members tab
        (filteredMembers.length === 0 ? (
          <p className="text-white/70 text-sm">No members yet.</p>
        ) : (
          <ul role="list">
            {filteredMembers.map((m) => (
              <li key={m.userId} className="px-1 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.user.avatar ? (
                        <img
                          src={m.user.avatar}
                          alt=""
                          className="h-5 w-5 rounded-full ring-1 ring-white/15 object-cover"
                        />
                      ) : (
                        <span className="h-5 w-5 rounded-full ring-1 ring-white/15 bg-white/10 inline-block" />
                      )}
                      <a
                        href={m.user.username ? `/u/${m.user.username}` : "#"}
                        className="truncate text-[14px] font-medium hover:underline"
                        style={{ color: "#cae1f4" }}
                        title={m.user.username ?? "unknown"}
                      >
                        {m.user.username ?? "unknown"}
                      </a>
                      <span
                        className={[
                          "inline-flex items-center px-2 py-[2px] rounded-md text-[11px]",
                          m.role === "TEACHER" ? "bg-white/10 text-white/90" : "bg-white/5 text-white/70",
                        ].join(" ")}
                      >
                        {m.role === "TEACHER" ? "Teacher" : "Student"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Joined {timeAgo(String(m.joinedAt))}
                    </div>
                  </div>

                  {/* Right-side actions per role */}
                  <div className="flex items-center gap-2">
                    {isTeacher ? (
                      m.role === "STUDENT" ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Remove this student from the class?")) return;
                            try {
                              const res = await fetch(`/api/classes/${id}/members/${m.userId}`, { method: "DELETE" });
                              const js = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                alert(js?.error || "Failed to remove member.");
                                return;
                              }
                              // Optimistic update
                              setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
                            } catch (e: any) {
                              alert(e?.message || "Network error.");
                            }
                          }}
                          className={[
                            "inline-flex items-center justify-center rounded-[6px]",
                            "h-7 px-3",
                            "text-white/90 hover:text-white text-[12px]",
                            "bg-white/5 hover:bg-white/10",
                            "ring-1 ring-white/20 hover:ring-white/10",
                            "transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                          ].join(" ")}
                        >
                          Remove
                        </button>
                      ) : null
                    ) : (
                      <a
                        href={`/u/${encodeURIComponent(m.user.id)}`}
                        className={[
                          "inline-flex items-center justify-center rounded-[6px]",
                          "h-7 px-3",
                          "text-white/90 hover:text-white text-[12px]",
                          "bg-white/5 hover:bg-white/10",
                          "ring-1 ring-white/20 hover:ring-white/10",
                          "transition-colors",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2",
                        ].join(" ")}
                      >
                        View profile
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-5 mb-0 border-b border-white/10" />
              </li>
            ))}
          </ul>
        ))
      )}

      {/* ASSIGN SET MODAL (Teacher) */}
      {isTeacher && (
        <AssignSetModal
          open={assignOpen}
          classId={String(id)}
          existingSetIds={sets.map((s) => s.id)}
          onClose={() => setAssignOpen(false)}
          onAssigned={async () => {
            await refreshClass(); // refresh sets after add
            setAssignOpen(false);
          }}
        />
      )}

      {/* ===== RENAME CLASS MODAL ===== */}
      {isTeacher && renameOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/50" onClick={() => !renameBusy && setRenameOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-[min(520px,96vw)] rounded-xl bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium text-white">Rename class</div>
                  <button
                    type="button"
                    onClick={() => !renameBusy && setRenameOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <img src="/icons/close.svg" alt="" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 border-t border-white/10" />
                <div className="mt-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-white/70">Class name</span>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g., Biology 10 – Section A"
                      className="h-9 w-full rounded-md px-3 text-[13px] bg-[#18062e] ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/60 text-white/90"
                    />
                  </label>
                </div>
                <div className="mt-4 border-t border-white/10" />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !renameBusy && setRenameOpen(false)}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!newName.trim() || renameBusy}
                    onClick={async () => {
                      try {
                        setRenameBusy(true);
                        const res = await fetch(`/api/classes/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newName.trim() }),
                        });
                        const js = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          alert(js?.error || "Failed to rename class.");
                          return;
                        }
                        setName(newName.trim());
                        setRenameOpen(false);
                      } catch (e: any) {
                        alert(e?.message || "Network error.");
                      } finally {
                        setRenameBusy(false);
                      }
                    }}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-white/90 hover:text-white",
                      "bg-[#532e95] hover:bg-[#5f3aa6] active:bg-[#472b81]",
                      "ring-1 ring-white/20 hover:ring-white/10",
                      "transition-colors",
                      "text-sm font-medium",
                      (!newName.trim() || renameBusy) ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CLASS MODAL ===== */}
      {isTeacher && deleteOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleteBusy && setDeleteOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-[min(520px,96vw)] rounded-xl bg-[var(--bg,#18062e)] ring-1 ring-white/15 shadow-xl">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium text-white">Delete class</div>
                  <button
                    type="button"
                    onClick={() => !deleteBusy && setDeleteOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <img src="/icons/close.svg" alt="" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 border-t border-white/10" />
                <p className="mt-3 text-sm text-white/80">
                  This will permanently delete <span className="text-white font-medium">{name}</span> and unassign all sets.
                  This action cannot be undone.
                </p>
                <div className="mt-4 border-t border-white/10" />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !deleteBusy && setDeleteOpen(false)}
                    className="h-8 px-2.5 rounded-[6px] text-white/80 hover:text-white ring-1 ring-white/12 hover:bg-white/10 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={async () => {
                      try {
                        setDeleteBusy(true);
                        const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
                        const js = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          alert(js?.error || "Failed to delete class.");
                          return;
                        }
                        router.push("/classes");
                      } catch (e: any) {
                        alert(e?.message || "Network error.");
                      } finally {
                        setDeleteBusy(false);
                      }
                    }}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[6px]",
                      "h-8 px-2.5",
                      "text-red-100 hover:text-white",
                      "bg-red-500/20 hover:bg-red-500/30",
                      "ring-1 ring-red-400/40 hover:ring-red-300/50",
                      "transition-colors",
                      "text-sm font-medium",
                    ].join(" ")}
                  >
                    Delete class
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==== STUDY MODAL MOUNT (student view) ← ADD */}
      {role === "STUDENT" && (
        <StudyModal
          open={studyOpen}
          title={studyTarget?.title ?? ""}
          onClose={closeStudy}
          onPick={onPickStudy}
        />
      )}
    </>
  );
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(1, Math.floor((now - d) / 1000));
  const mins = Math.floor(sec / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return `${sec}s ago`;
}
