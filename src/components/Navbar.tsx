import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a092d]">
      <div className="container mx-auto h-[80px] px-4 flex items-center gap-4">
        {/* Logo (unchanged alignment) */}
        <Link
          href="/"
          aria-label="Quizzify home"
          className="font-[var(--font-inter)] text-[30px] leading-none select-none no-underline shrink-0"
        >
          <span className="font-bold text-[#4262ff]">Quizz</span>
          <span className="font-normal text-white">ify</span>
        </Link>

        {/* Search (desktop) — matches main */}
        <form action="/search" className="hidden md:block flex-1 max-w-xl mx-auto">
          <label htmlFor="site-search" className="sr-only">
            Search study sets
          </label>
          <div className="relative group">
            {/* icon */}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70 group-focus-within:text-white"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>

            {/* input */}
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Flashcard sets, textbooks, questions"
              autoComplete="off"
              className="w-full h-11 rounded-xl bg-[#2a3154]/85 text-white placeholder-white/80
                         pl-10 pr-4 text-sm ring-1 ring-white/10
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30
                         focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a092d] transition"
            />
            <button type="submit" className="sr-only">Search</button>
          </div>
        </form>

        {/* Mobile search link (kept) */}
        <Link
          href="/search"
          aria-label="Search"
          className="md:hidden inline-flex items-center justify-center rounded-xl px-3 py-2 bg-white/10 text-white/80"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </Link>

        {/* Sign In (left as-is) */}
        <Link
          href="/signin"
          className="btn-primary font-[var(--font-inter)] font-bold flex items-center justify-center"
          style={{ width: "100px", height: "40px", fontSize: "16px" }}
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
