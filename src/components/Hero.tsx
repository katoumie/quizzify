import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-gradient-to-br from-[#3A6FD9] via-[#8FB8FF] to-[#F8BFD4]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10" />
      </div>

      {/* Integrated navbar (anchored edges, slimmer) */}
      <nav className="relative w-full px-4 h-14 flex items-center justify-between">
        {/* Logo anchored left */}
        <div className="flex items-center">
          <Image
            src="/logo-q.png"
            alt="Quizzify Q"
            width={48}
            height={48}
            priority
            className="drop-shadow-md"
          />
        </div>

        {/* Buttons anchored right */}
        <div className="flex items-center gap-3">
          <Link
            href="/signin"
            className="px-5 py-2 rounded-xl font-semibold text-[#0a092d] bg-white border-2 border-black shadow-md hover:-translate-y-0.5 transition"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 rounded-xl font-semibold text-white bg-[#0a092d] border-2 border-black shadow-md hover:-translate-y-0.5 transition"
          >
            Create account
          </Link>
        </div>
      </nav>

      {/* Main hero content — pulled up */}
      <div className="relative mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 pt-0 -mt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 lg:gap-12 min-h-[calc(100vh-3.5rem)]">
          {/* Left: logo text + heading */}
          <div className="text-white max-w-[42rem]">
            {/* Wordmark above heading, tighter spacing */}
            <div className="mb-2">
              <Image
                src="/logo.png"
                alt="Quizzify"
                width={800}
                height={100}
                priority
                className="w-full max-w-[800px] h-auto"
              />
            </div>

            <h1 className="font-[var(--font-display-fredoka)] text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]">
              Learning made fun.
            </h1>
            <p className="mt-3 text-white/85 text-base md:text-lg">
              Level up with streaks, badges, and smart flashcards. Study sessions feel like quests, not chores.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/learn"
                className="px-6 py-3 rounded-xl font-semibold text-[#0a092d] bg-white border-2 border-black shadow-md hover:-translate-y-0.5 transition"
              >
                Start learning
              </Link>
              <Link
                href="/explore"
                className="px-6 py-3 rounded-xl font-semibold text-white bg-[#0a092d] border-2 border-black shadow-md hover:-translate-y-0.5 transition"
              >
                Explore sets
              </Link>
            </div>
          </div>

          {/* Right: mascot inside grid */}
          <div className="relative flex justify-center md:justify-end">
            <div className="absolute right-8 top-1/2 -translate-y-1/2 h-[50%] w-[50%] rounded-full bg-white/30 blur-3xl opacity-40 pointer-events-none" />
            <Image
              src="/hero/mascot.png"
              alt="Quizzify mascot"
              priority
              width={1000}
              height={1000}
              sizes="(min-width:1280px) 40vw, (min-width:768px) 45vw, 80vw"
              className="h-auto select-none pointer-events-none"
              style={{ width: "clamp(320px, 40vw, 700px)" }}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/30" />
    </section>
  );
}
