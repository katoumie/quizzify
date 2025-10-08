// /src/app/(main)/main/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SvgFileIcon from "@/components/SvgFileIcon";
import ClientGreeting from "@/components/ClientGreeting";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

// Lightweight “trending” pulls PUBLIC sets by likes, then recency
async function getTrending() {
  try {
    const sets = await prisma.studySet.findMany({
      where: { isPublic: true },
      orderBy: [{ likedBy: { _count: "desc" } }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        description: true,
        updatedAt: true,
        owner: { select: { username: true, avatar: true } },
        _count: { select: { cards: true, likedBy: true } },
      },
    });
    return sets;
  } catch {
    return [];
  }
}



export default async function MainPage() {
  const trending = await getTrending();

  return (
    <div className="space-y-6">
      {/* Hero / Greeting */}
      <section className="rounded-2xl border border-white/10 bg-[var(--bg-card,#1a1330)] p-6 text-white">
        <div className="flex items-start justify-between gap-6">
          <ClientGreeting />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sets/new"
              prefetch={false}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold",
                "bg-[#532e95] hover:bg-[#5f3aa6] ring-1 ring-white/20"
              )}
            >
              <SvgFileIcon src="/icons/add_24.svg" className="h-4 w-4" />
              New set
            </Link>
            <Link
              href="/explore"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 ring-1 ring-white/15"
            >
              <SvgFileIcon src="/icons/compass.svg" className="h-4 w-4" />
              Explore public sets
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/magic-notes"
            prefetch={false}
            className="group rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#532e95]/30 ring-1 ring-white/10">
                <SvgFileIcon src="/icons/upload.svg" className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">Create from files</div>
                <div className="text-[12px] text-white/70">PDF, DOCX, PPTX → auto cards</div>
              </div>
            </div>
          </Link>

          <Link
            href="/arena"
            prefetch={false}
            className="group rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#41a7f8]/20 ring-1 ring-white/10">
                <SvgFileIcon src="/icons/bolt.svg" className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">Start a Duel</div>
                <div className="text-[12px] text-white/70">Arena mode with any set</div>
              </div>
            </div>
          </Link>

          <Link
            href="/classes"
            prefetch={false}
            className="group rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <SvgFileIcon src="/icons/class.svg" className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">Join or manage classes</div>
                <div className="text-[12px] text-white/70">Assign sets, track progress</div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Trending / recommendations */}
      <section className="rounded-2xl border border-white/10 bg-[var(--bg-card,#1a1330)] p-6 text-white">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trending public sets</h2>
          <Link
            href="/explore?sort=likes"
            prefetch={false}
            className="text-sm text-white/80 hover:text-white underline decoration-transparent hover:decoration-white/60"
          >
            See all
          </Link>
        </div>

        {trending.length === 0 ? (
          <div className="text-white/60 text-sm">No public sets yet. Be the first to create one!</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((s) => {
              const likes = s._count.likedBy ?? 0;
              const terms = s._count.cards ?? 0;
              return (
                <Link
                  key={s.id}
                  href={`/sets/${s.id}`}
                  prefetch={false}
                  className={cn(
                    "group rounded-xl p-4 ring-1 ring-white/12 bg-white/5 hover:bg-white/10 transition"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold line-clamp-1 text-[#41a7f8] group-hover:underline">
                        {s.title}
                      </div>
                      <div className="mt-0.5 text-[12px] text-white/60 line-clamp-2">
                        {s.description || "—"}
                      </div>
                    </div>
                    <div className="shrink-0 grid place-items-center h-9 w-9 rounded-md bg-white/10 ring-1 ring-white/10">
                      {/* avatar or fallback */}
                      {s.owner?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.owner.avatar} alt="" className="h-9 w-9 rounded-md object-cover" />
                      ) : (
                        <span className="text-sm text-white/70">u/{s.owner?.username ?? "anon"}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[12px] text-white/70">
                    <span className="inline-flex items-center gap-1">
                      <SvgFileIcon src="/icons/study_sets.svg" className="h-3.5 w-3.5 opacity-80" />
                      {terms} terms
                    </span>
                    <span className="opacity-40">•</span>
                    <span className="inline-flex items-center gap-1">
                      <SvgFileIcon src="/icons/like.svg" className="h-3.5 w-3.5 opacity-80" />
                      {likes}
                    </span>
                    <span className="opacity-40">•</span>
                    <span>Updated {relTime(s.updatedAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Study starters */}
      <section className="rounded-2xl border border-white/10 bg-[var(--bg-card,#1a1330)] p-6 text-white">
        <h2 className="text-lg font-semibold mb-3">Get started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/sets/new?mode=manual"
            prefetch={false}
            className="rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition block"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <SvgFileIcon src="/icons/edit.svg" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Build manually</div>
                <div className="text-[12px] text-white/70">Type terms & definitions</div>
              </div>
            </div>
          </Link>

          <Link
            href="/sets/new?gen=ai"
            prefetch={false}
            className="rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition block"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#532e95]/30 ring-1 ring-white/10">
                <img src="/icons/wand.svg" alt="" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Generate with AI</div>
                <div className="text-[12px] text-white/70">From your documents</div>
              </div>
            </div>
          </Link>

          <Link
            href="/explore?sort=updated"
            prefetch={false}
            className="rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition block"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#41a7f8]/20 ring-1 ring-white/10">
                <SvgFileIcon src="/icons/clock.svg" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Study something new</div>
                <div className="text-[12px] text-white/70">Recently updated sets</div>
              </div>
            </div>
          </Link>

          <Link
            href="/profile"
            prefetch={false}
            className="rounded-xl ring-1 ring-white/12 bg-white/5 hover:bg-white/10 p-4 transition block"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <SvgFileIcon src="/icons/user.svg" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Update profile</div>
                <div className="text-[12px] text-white/70">Avatar, username, more</div>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
