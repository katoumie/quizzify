"use client";

import type { ReactNode } from "react";

export default function LibrarySection<T>({
  title,
  items,
  emptyMessage,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-white/70 text-sm">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(renderItem)}
        </ul>
      )}
    </section>
  );
}
