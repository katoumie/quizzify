// /src/app/(landing)/hero.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Hero() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY >= 120); // delayed solid
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    router.push(`/signin?mode=signup&email=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="relative isolate min-h-screen overflow-hidden">
      {/* Background (solid top, gradient only at the bottom) */}
      <div className="absolute inset-0 -z-20">
        {/* Solid base updated to #070942 */}
        <div className="absolute inset-0 bg-[#070942]" />

        {/* Soft dark band (starts lower; reduced coverage) */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[48vh]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(7,9,66,0) 0%, rgba(18,22,56,0.75) 58%, rgba(18,22,56,0.92) 82%, rgba(18,22,56,0) 100%)",
          }}
        />

        {/* Bottom lighter gradient starts later (reduced height & pushed stops) */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[30vh]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(7,9,66,0) 0%, #1e2f4b 55%, #28516a 80%, #2d6e88 100%)",
          }}
        />
      </div>

      {/* Fixed Navbar (70px). Transparent at top; fades to #0d1117 after ~120px */}
      <header className="fixed inset-x-0 top-0 z-50 h-[70px]">
        <nav className="relative w-full h-full px-6 sm:px-8 lg:px-14 flex items-center justify-between">
          {/* Fade layer */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out ${
              scrolled ? "opacity-100 delay-150" : "opacity-0 delay-0"
            }`}
            style={{ backgroundColor: "#0d1117" }}
          />
          {/* Content */}
          <div className="relative z-10 flex items-center">
            <Image
              src="/logo-q.png"
              alt="Quizzify Q"
              width={40}
              height={40}
              priority
              className="drop-shadow-md"
            />
          </div>
          <div className="relative z-10 flex items-center gap-2 sm:gap-3">
            <Link
              href="/signin"
              className="px-1.5 py-1.5 sm:px-2 sm:py-2 text-sm font-medium text-white/90 hover:text-white decoration-white/40 hover:decoration-white transition"
            >
              Sign in
            </Link>
            <Link
              href="/signin?mode=signup"
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-[var(--btn-contrast)] bg-[var(--brand)] shadow-md hover:-translate-y-0.5 transition"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Spacer so content doesn't sit under the fixed nav */}
      <div className="h-[70px]" />

      {/* Main hero */}
      <div className="relative mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 pt-0 -mt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 lg:gap-12 min-h-[calc(100vh-70px)]">
          <div className="text-white max-w-[42rem]">
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

            <h1 className="font-[var(--font-display-fredoka)] text-4xl md:text-6xl font-extrabold leading-tight">
              Learning made fun
            </h1>
            <p className="mt-3 text-white/100 text-base md:text-lg">
              Join to make your study session feel like quests, not chores.
            </p>

            {/* Email capture */}
            <form onSubmit={onSubmit} className="mt-6">
              <div className="flex w-full max-w-2xl items-center gap-1 rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/10">
                <div className="relative flex-1">
                  <input
                    id="hero-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={focused && !email ? "you@domain.com" : " "}
                    className="peer h-12 w-full bg-transparent px-4 pt-3 text-[15px] text-black placeholder-black/40 focus:outline-none rounded-lg ring-0 focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <label
                    htmlFor="hero-email"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-black/60 transition-all duration-150 ease-out peer-focus:top-1 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-black/70 peer-[&:not(:placeholder-shown)]:top-1 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-xs peer-[&:not(:placeholder-shown)]:text-black/70"
                  >
                    Enter your email
                  </label>
                </div>

                {/* Slimmer CTA button */}
                <button
                  type="submit"
                  className="h-11 px-4 text-[14px] font-semibold rounded-lg text-[var(--btn-contrast)] bg-[var(--brand)] hover:brightness-110 transition whitespace-nowrap"
                >
                  Sign Up for Quizzify
                </button>
              </div>
            </form>
          </div>

          {/* Mascot */}
          <div className="relative flex justify-center md:justify-end">
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

      <div className="absolute inset-x-0 bottom-0 h-px bg-white/30" />

      {/* Brand tokens */}
      <style jsx global>{`
        :root {
          --brand: #4262ff;        /* primary brand */
          --accent: #a8b1ff;       /* active/focus accent */
          --btn-contrast: #ffffff; /* text on brand button */
        }
      `}</style>
    </section>
  );
}
