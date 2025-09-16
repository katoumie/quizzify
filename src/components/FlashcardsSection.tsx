import Image from "next/image";

export default function FlashcardsSection() {
  return (
    <section id="flashcards" className="pt-8 pb-16 md:pt-12 md:pb-20 ">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-4">
        {/* Left card mock */}
        <div className="card p-8 flex items-center justify-center !bg-[#5845cc]">
          <div className="relative w-full max-w-[360px] aspect-[4/3] -translate-x-3 -translate-y-4">
            {/* back card */}
            <div className="absolute inset-0 rounded-2xl bg-[#e0e0e0]/95 translate-x-6 translate-y-6" />
            {/* front card */}
            <div className="absolute inset-0 rounded-2xl bg-white flex items-center justify-center rotate-[-2deg]">
              <div className="flex items-center gap-8">
                {/* Text */}
                <div className="text-center">
                  <div className="text-2xl font-normal text-black leading-tight">
                    Human
                  </div>
                  <div className="text-2xl font-normal text-black leading-tight">
                    Brain
                  </div>
                </div>

                {/* Icon */}
                <div className="ml-4">
                  <Image
                    src="/icons/brain.png"
                    alt="Brain icon"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right copy */}
        <div>
          <h2 className="h2">Flashcards</h2>
          <p className="lead mt-3">
            Familiarize yourself with your learning material using{" "}
            <strong>Flashcards</strong>. You can create your own or let Quizzify
            automatically generate them from a PDF using AI.
          </p>
          <div className="mt-8">
            <a
              href="#"
              className="btn-primary font-[var(--font-inter)] font-bold text-[16px]"
            >
              Create Flashcards
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
