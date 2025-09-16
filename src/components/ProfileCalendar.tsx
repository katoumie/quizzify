"use client";

import { useMemo } from "react";

export default function ProfileCalendar({ activityDates = [] }: { activityDates?: string[] }) {
  const active = useMemo(() => new Set(activityDates || []), [activityDates]);

  // Build last 5 weeks (Sun..Sat) ending this week
  const weeks = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() - end.getDay()); // last Sunday
    const start = new Date(end);
    start.setDate(start.getDate() - 7 * 4); // 5 weeks total

    const result: string[][] = [];
    let cursor = new Date(start);

    for (let w = 0; w < 5; w++) {
      const row: string[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(toISO(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(row);
    }
    return result;
  }, []);

  return (
    <div className="inline-grid grid-cols-7 gap-1 rounded-xl p-3 ring-1 ring-white/10 bg-white/5">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="text-[10px] text-white/60 text-center mb-1">
          {d}
        </div>
      ))}
      {weeks.flat().map((iso) => (
        <div
          key={iso}
          title={iso}
          className={`h-5 w-5 rounded-sm ${
            active.has(iso) ? "bg-[var(--brand)]" : "bg-white/15"
          }`}
        />
      ))}
    </div>
  );
}

function toISO(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
