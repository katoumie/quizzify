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
    const onScroll = () => setScrolled(window.scrollY >= 120);
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
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-[#18062e]" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[48vh]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(24,6,46,0) 0%, rgba(24,6,46,0.65) 58%, rgba(24,6,46,0.90) 82%, rgba(24,6,46,0) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[30vh]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(24,6,46,0) 0%, #2a1a63 55%, #3b2a86 80%, #4e3fb9 100%)",
          }}
        />
      </div>

      {/* Fixed Navbar (70px) */}
      <header className="fixed inset-x-0 top-0 z-50 h-[70px]">
        <nav
          className="relative w-full h-full flex items-center justify-between"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
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

      {/* Main hero — pad top equals nav height + small gap */}
      <div className="relative mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-[86px]">
        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 lg:gap-10 min-h-[calc(100svh-70px)]">
          {/* Left: copy + wordmark */}
          <div className="text-white max-w-[44rem]">
            <div className="mb-1">
              <Image
                src="/logo.png"
                alt="Quizzify"
                width={720}
                height={120}
                priority
                className="w-full max-w-[520px] sm:max-w-[560px] md:max-w-[600px] lg:max-w-[680px] h-auto"
              />
            </div>

            <h1 className="font-[var(--font-display-fredoka)] text-4xl md:text-6xl font-bold leading-tight">
              Smarter studying, powered by AI.
            </h1>
            <p className="mt-3 text-white/100 font-semibold text-base md:text-lg">
              Join to make every study session more effective and engaging.
            </p>

            {/* Email capture */}
            <form onSubmit={onSubmit} className="mt-5">
              <div className="flex w-full max-w-2xl items-stretch gap-2 rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/10 flex-col sm:flex-row">
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
                    className="peer h-11 w-full bg-transparent px-4 pt-3 text-[15px] text-black placeholder-black/40 focus:outline-none rounded-lg ring-0 focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <label
                    htmlFor="hero-email"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-black/60 transition-all duration-150 ease-out peer-focus:top-1 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-black/70 peer-[&:not(:placeholder-shown)]:top-1 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-xs peer-[&:not(:placeholder-shown)]:text-black/70"
                  >
                    Enter your email
                  </label>
                </div>

                <button
                  type="submit"
                  className="h-11 px-4 text-[14px] font-semibold rounded-lg text-[var(--btn-contrast)] bg-[var(--brand)] hover:brightness-110 transition whitespace-nowrap w-full sm:w-auto"
                >
                  Sign Up for Quizzify
                </button>
              </div>
            </form>
          </div>

          {/* Right: mascot */}
          <div className="relative flex justify-center md:justify-end">
            <Image
              src="/hero/mascot.svg"
              alt="Quizzify mascot"
              priority
              width={1000}
              height={1000}
              sizes="(min-width:1280px) 40vw, (min-width:768px) 42vw, 80vw"
              className="h-auto select-none pointer-events-none"
              style={{ width: "min(700px, 42vw)" }}
            />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-white/30" />

      <style jsx global>{`
        :root {
          --brand: #4262ff;
          --accent: #a8b1ff;
          --btn-contrast: #ffffff;
        }
      `}</style>
    </section>
  );
}
