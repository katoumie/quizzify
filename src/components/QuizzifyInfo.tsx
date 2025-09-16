export default function QuizzifyInfo() {
  return (
    <section id="quizzify-info" className="pt-16 pb-24 md:pt-20 md:pb-28">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="h2">The Technology Behind Quizzify</h2>
          <p className="lead mt-4">
            Quizzify blends learning science with adaptive AI. Under the hood,
            Bayesian modeling estimates concept mastery in real time, while spaced
            repetition schedules reviews at optimal intervals. Layered gamification
            keeps motivation high, and modern NLP helps turn your materials into
            quizzes and flashcards—fast.
          </p>
        </div>

        {/* Feature grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card: BKT */}
          <FeatureCard
            title="Bayesian Knowledge Tracing"
            desc="A probabilistic model tracks what you likely know after each answer, adapting difficulty and sequencing per learner."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 12h18" />
                <path d="M7 12c0-3.314 2.686-6 6-6 2.761 0 5 2.239 5 5v7H7v-6Z" />
                <circle cx="9" cy="15" r="1" />
              </svg>
            }
          />

          {/* Card: Spaced Repetition */}
          <FeatureCard
            title="Spaced Repetition"
            desc="Optimizes review timing along the forgetting curve to cement long-term memory with fewer total study minutes."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            }
          />

          {/* Card: Gamification */}
          <FeatureCard
            title="Motivating Gamification"
            desc="Badges, streaks, levels, and gentle challenges convert consistency into progress without distracting from learning."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 21l4-2 4 2V5a4 4 0 10-8 0v16z" />
              </svg>
            }
          />

          {/* Card: AI Content Generation */}
          <FeatureCard
            title="AI Content Generation"
            desc="NLP assists in turning PDFs and notes into clean flashcards and quizzes, with explain-like-I’m-5 clarifications."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 19h16M7 4h10l3 3v8a4 4 0 01-4 4H7a4 4 0 01-4-4V8l4-4z" />
                <path d="M9 12h6M9 9h3" />
              </svg>
            }
          />

          {/* Card: Progress Analytics */}
          <FeatureCard
            title="Progress Analytics"
            desc="Mastery estimates, item difficulty, and study streaks surface what to review next and where confidence is low."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3v18h18" />
                <path d="M7 15v3M12 10v8M17 6v12" />
              </svg>
            }
          />

          {/* Card: Privacy & Control */}
          <FeatureCard
            title="Privacy & Control"
            desc="Only necessary data is stored for learning features. Clear controls let you reset history or export your data."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7l7-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
          />
        </div>

        {/* Subtle CTA (optional) */}
        <div className="mt-10 flex justify-center">
          <a
            href="#learn"
            className="btn-primary font-[var(--font-inter)] font-bold text-[16px]"
          >
            Join Quizzify
          </a>
        </div>
      </div>
    </section>
  );
}

/* --- Local component for feature cards --- */
function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm hover:bg-white/7 transition">
      {/* Accent ring on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-indigo-500/0 group-hover:ring-2 group-hover:ring-indigo-500/40 transition" />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-xl bg-indigo-500/20 p-2 text-indigo-300">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-gray-300">{desc}</p>
        </div>
      </div>
    </div>
  );
}
