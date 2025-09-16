export default function LearnSection() {
  return (
    <section className="pt-0 md:pt-0 pb-16 md:pb-20">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-4">
        {/* Left copy (right aligned) */}
        <div className="text-right">
          <h2 className="h2">Learn</h2>
          <p className="lead mt-3">
            Engage in an AI-powered study session using <strong>Quizzify Learn</strong>.
            Master concepts through adaptive quizzes and smart feedback.
          </p>
          <div className="mt-8 flex justify-end">
            <a
              href="#"
              className="btn-primary font-[var(--font-inter)] font-bold text-[16px]"
            >
              Start Learning
            </a>
          </div>
        </div>

        {/* Right card mock */}
        <div className="card p-8 flex items-center justify-center !bg-[#d1305e]">
          <div className="relative w-full max-w-[360px] aspect-[4/3] -translate-y-4">
            {/* White card with quiz */}
            <div className="absolute inset-0 rounded-2xl bg-white translate-x-0 translate-y-4 flex items-center justify-center p-6 text-black">
              <div className="w-full max-w-[280px]">
                <p className="text-center font-semibold leading-snug">
                  What is the largest organ of the human body?
                </p>
                <ul className="mt-4 space-y-2 text-[15px]">
                  <li className="flex items-center">
                    <span className="font-bold mr-2">A.</span>
                    <span>Skin</span>
                    <span className="ml-2 text-green-600" aria-hidden="true">✔</span>
                  </li>
                  <li className="flex items-center">
                    <span className="font-bold mr-2">B.</span>
                    <span>Lungs</span>
                  </li>
                  <li className="flex items-center">
                    <span className="font-bold mr-2">C.</span>
                    <span>Heart</span>
                  </li>
                  <li className="flex items-center">
                    <span className="font-bold mr-2">D.</span>
                    <span>Kidney</span>
                  </li>
                </ul>
              </div>
            </div>
            {/* /White card */}
          </div>
        </div>
      </div>
    </section>
  );
}
