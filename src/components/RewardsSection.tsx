import Image from "next/image";

export default function RewardsSection() {
  return (
    <section id="rewards" className="pt-0 md:pt-0 pb-16 md:pb-20">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-4">
        {/* Left card mock (blue box with one white card) */}
        <div className="card p-8 flex items-center justify-center !bg-[#46854f]">
          <div className="relative w-full max-w-[360px] aspect-[4/3] -translate-y-0">
            {/* Single white card */}
            <div className="absolute inset-0 rounded-2xl bg-white flex items-center justify-center">
              <Image
                src="/icons/badge.png"
                alt="Reward badge"
                width={128}
                height={128}
                className="object-contain"
              />
            </div>
          </div>
        </div>

        {/* Right copy */}
        <div>
          <h2 className="h2">Rewards</h2>
          <p className="lead mt-3">
            Earn badges and other rewards by studying and completing challenges such as streaks.
          </p>
          <div className="mt-8">
            <a
              href="#"
              className="btn-primary font-[var(--font-inter)] font-bold text-[16px]"
            >
              View Rewards
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
