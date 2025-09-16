// /src/components/ProfileCalendarLarge.tsx
"use client";

import { useMemo, useState } from "react";

/** Pass dates the user studied as "YYYY-MM-DD" (preferred) or full ISO strings. */
export default function ProfileCalendarLarge({
  studiedDates = [],
  initialMonth = new Date(),
}: {
  studiedDates?: string[];
  initialMonth?: Date;
}) {
  // ---------- helpers: LOCAL day keys ----------
  const dayKeyLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const normalizeToLocalKey = (s: string) => {
    // If plain "YYYY-MM-DD", use as-is. Otherwise parse and convert to local key.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : dayKeyLocal(d);
  };

  // ---------- month state ----------
  const [view, setView] = useState(() => {
    const d = new Date(initialMonth);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Normalize incoming dates to local day keys once
  const studiedSet = useMemo(
    () => new Set(studiedDates.map(normalizeToLocalKey)),
    [studiedDates]
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
        view
      ),
    [view]
  );

  // ---------- build 6x7 grid starting Sunday ----------
  const grid = useMemo(() => {
    const first = new Date(view);
    first.setDate(1);
    first.setHours(0, 0, 0, 0);

    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // back to Sunday
    start.setHours(0, 0, 0, 0);

    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push({ date: d, inMonth: d.getMonth() === view.getMonth() });
    }
    return days;
  }, [view]);

  // ---------- date utils ----------
  const isStudied = (d: Date) => studiedSet.has(dayKeyLocal(d));
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const prevMonth = () => {
    const n = new Date(view);
    n.setMonth(n.getMonth() - 1, 1);
    n.setHours(0, 0, 0, 0);
    setView(n);
  };
  const nextMonth = () => {
    const n = new Date(view);
    n.setMonth(n.getMonth() + 1, 1);
    n.setHours(0, 0, 0, 0);
    setView(n);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-5 text-white">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-lg font-semibold">{monthLabel}</h3>
        <div className="ml-auto mr-3 flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-2 text-white/70">
            <span className="text-xl leading-none">🔥</span>
            <span className="text-white/70">Studied</span>
          </span>
          <span className="inline-flex items-center gap-2 text-white/70">
            <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/70" />
            <span className="text-white/70">Today</span>
          </span>
        </div>
        <div className="flex gap-2">
          <IconBtn onClick={prevMonth} title="Previous month">
            <ChevronLeft />
          </IconBtn>
          <IconBtn onClick={nextMonth} title="Next month">
            <ChevronRight />
          </IconBtn>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-white/70">
        {(["S", "M", "T", "W", "T", "F", "S"] as const).map((d, idx) => (
          <div key={`dow-${idx}`} className="py-1 whitespace-nowrap">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-x-3 gap-y-4">
        {grid.map(({ date, inMonth }, i) => {
          const col = i % 7;
          const studied = isStudied(date);
          const isToday = isSameDay(date, today);

          const studiedPrev = col > 0 && isStudied(addDays(date, -1));
          const studiedNext = col < 6 && isStudied(addDays(date, +1));

          return (
            <div key={dayKeyLocal(date) + "-" + i} className="relative h-10 md:h-11" aria-current={isToday ? "date" : undefined}>
              {/* soft glow */}
              {studied && (
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/25 blur-[6px]" />
              )}
              {/* connectors */}
              {studied && studiedPrev && (
                <span className="pointer-events-none absolute left-0 top-1/2 h-5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/20 blur-[6px]" />
              )}
              {studied && studiedNext && (
                <span className="pointer-events-none absolute right-0 top-1/2 h-5 w-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/20 blur-[6px]" />
              )}

              {/* content */}
              <div className="relative grid h-full place-items-center">
                <div className="relative">
                  {/* ring circles the number OR the flame */}
                  {isToday && <span className="pointer-events-none absolute -inset-2 rounded-full ring-2 ring-white/70" />}
                  {studied ? (
                    <span className="text-[18px] leading-none md:text-[20px]">🔥</span>
                  ) : (
                    <span className={`text-sm md:text-base ${inMonth ? "text-white" : "text-white/40"}`}>{date.getDate()}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------ tiny UI bits ------------ */
function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-white/15 hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
