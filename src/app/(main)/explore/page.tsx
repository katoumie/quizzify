// /src/app/(main)/explore/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SvgFileIcon from "@/components/SvgFileIcon";

type SearchParams = {
  q?: string;
  filter?: "all" | "liked"; // "liked" = sets that have at least one like (popular)
  sort?: "updated" | "likes" | "name";
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function relTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

function chip(cls: string, children: React.ReactNode) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] leading-[18px]",
        "ring-1 ring-white/20",
        cls
      )}
    >
      {children}
    </span>
  );
}

/** Compact dropdown trigger (GitHub-ish) */
function CompactTrigger({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "h-8 px-2.5 rounded-md text-[13px] inline-flex items-center gap-1",
        "bg-[#18062e] ring-1 ring-white/12 hover:ring-white/20",
        "text-white/90"
      )}
      prefetch={false}
    >
      <span className="opacity-80">{label}:</span>
      <span className="font-semibold">{value}</span>
      <SvgFileIcon src="/icons/dropdown.svg" className="w-3.5 h-3.5 opacity-80" />
    </Link>
  );
}

/** Compact search input (NavSearch style, simple version) */
function SearchBox({ q }: { q?: string }) {
  return (
    <form className="flex-1 min-w-0" action="/explore">
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder="Search public sets…"
        className={cn(
          "w-full h-8 rounded-md px-3 text-[13px]",
          "bg-[#18062e] placeholder-white/60 text-white",
          "ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-[#a8b1ff]/80"
        )}
      />
      {/* If you later want to preserve filter/sort on submit, add hidden inputs here. */}
    </form>
  );
}

function rowHref(params: URLSearchParams, key: string, value: string) {
  const copy = new URLSearchParams(params);
  copy.set(key, value);
  return `/explore?${copy.toString()}`;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = (searchParams.q ?? "").trim();
  const filter = searchParams.filter ?? "all";
  const sort = searchParams.sort ?? "updated";

  // Explore shows only PUBLIC sets
  const where: any = {
    isPublic: true,
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { owner: { username: { contains: q, mode: "insensitive" } } },
    ];
  }

  // "liked" filter = sets that have at least one like (popular)
  if (filter === "liked") {
    where.likedBy = { some: {} };
  }

  const orderBy =
    sort === "likes"
      ? [{ likedBy: { _count: "desc" } as const }, { updatedAt: "desc" as const }]
      : sort === "name"
      ? [{ title: "asc" as const }]
      : [{ updatedAt: "desc" as const }];

  // Pull fields needed by Explore list
  const sets = await prisma.studySet.findMany({
    where,
    orderBy,
    take: 60,
    select: {
      id: true,
      title: true,
      description: true,
      updatedAt: true,
      isPublic: true,
      owner: { select: { username: true, avatar: true } },
      _count: { select: { cards: true, likedBy: true } },
    },
  });

  // Build current params for links
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  baseParams.set("filter", filter);
  baseParams.set("sort", sort);

  const filterLabel = filter === "liked" ? "Liked" : "All";
  const sortLabel =
    sort === "likes" ? "Likes" : sort === "name" ? "Name" : "Last updated";

  return (
    <div className="px-5 py-6 text-white">
      {/* Top row: Search + Compact triggers */}
      <div className="flex items-center gap-2">
        <SearchBox q={q} />
        <CompactTrigger
          label="Filter"
          value={filterLabel}
          href={rowHref(baseParams, "filter", filter === "liked" ? "all" : "liked")}
        />
        <CompactTrigger
          label="Sort"
          value={sortLabel}
          href={
            sort === "updated"
              ? rowHref(baseParams, "sort", "likes")
              : sort === "likes"
              ? rowHref(baseParams, "sort", "name")
              : rowHref(baseParams, "sort", "updated")
          }
        />
      </div>

      {/* Status row */}
      <div className="mt-2 text-[12.5px] text-white/70">
        {sets.length} results for public sets sorted by {sortLabel.toLowerCase()}
        {q ? (
          <>
            {" "}
            — search: <span className="text-white/90 italic">“{q}”</span>
          </>
        ) : null}
        {filter === "liked" ? " — (with likes)" : null}
      </div>

      {/* List */}
      <div className="mt-5 divide-y divide-white/10">
        {sets.map((s) => {
          const terms = s._count.cards ?? 0;
          const likes = s._count.likedBy ?? 0;
          return (
            <div key={s.id} className="py-4 flex items-start justify-between gap-4">
              {/* Left: title + meta */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sets/${s.id}`}
                    prefetch={false}
                    className={cn(
                      "text-[15px] font-semibold underline decoration-transparent",
                      "hover:decoration-white/60",
                      "text-[#41a7f8]"
                    )}
                  >
                    {s.title}
                  </Link>

                  {/* Visibility chip (single look, per Library convention) */}
                  {chip(
                    "bg-white/5",
                    <>
                      <SvgFileIcon src="/icons/dropdown.svg" className="w-3 h-3 rotate-90 opacity-70" />
                      Public
                    </>
                  )}

                  {/* Terms chip */}
                  {chip(
                    "bg-white/5",
                    <>
                      <SvgFileIcon src="/icons/study_sets.svg" className="w-3.5 h-3.5 opacity-80" />
                      {terms} terms
                    </>
                  )}
                </div>

                {/* Updated + owner */}
                <div className="mt-1 text-[12.5px] text-white/70">
                  Updated {relTime(s.updatedAt)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[13px] text-white/80">
                  {s.owner?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.owner.avatar}
                      alt={s.owner.username ?? "user"}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-white/10 ring-1 ring-white/20" />
                  )}
                  <span className="truncate">u/{s.owner?.username ?? "unknown"}</span>
                </div>

                {/* Optional description (single line) */}
                {s.description ? (
                  <p className="mt-2 text-[12.5px] text-white/70 line-clamp-1">
                    {s.description}
                  </p>
                ) : null}
              </div>

              {/* Right: likes + actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {/* Likes chip */}
                {chip(
                  "bg-white/5",
                  <>
                    <SvgFileIcon src="/icons/like.svg" className="w-3.5 h-3.5 opacity-80" />
                    {likes}
                  </>
                )}

                {/* Split pill: Study (left) + caret (right) */}
                <div className="flex">
                  <Link
                    href={`/sets/${s.id}/flashcards`}
                    prefetch={false}
                    className={cn(
                      "h-7 px-3 rounded-l-md text-[13px] inline-flex items-center",
                      "bg-[#532e95] ring-1 ring-white/20 hover:brightness-110"
                    )}
                  >
                    Study
                  </Link>
                  <button
                    className={cn(
                      "h-7 px-2 rounded-r-md text-[13px] inline-flex items-center",
                      "bg-[#18062e] ring-1 ring-white/20 hover:ring-white/30"
                    )}
                    aria-label="More actions"
                    disabled
                  >
                    <SvgFileIcon src="/icons/dropdown.svg" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {sets.length === 0 ? (
          <div className="py-16 text-center text-white/60">
            No public sets found. Try a different search.
          </div>
        ) : null}
      </div>
    </div>
  );
}
