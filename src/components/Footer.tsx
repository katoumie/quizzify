export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white text-gray-600 dark:border-gray-800 dark:bg-[#121024] dark:text-gray-400">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          {/* Left: brand + year */}
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-inter)] text-xl font-extrabold tracking-tight text-gray-800 dark:text-gray-100">
              Quizzify
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">© 2025</span>
          </div>

          {/* Right: blurb (one block) */}
          <div className="max-w-2xl text-xs leading-5 text-gray-500 dark:text-gray-400 md:text-right">
            <p>
              Quizzify is developed as a capstone project and as partial requirement for the completion of the program Bachelor of Science in Information
              Technology in the University of Perpetual Help System DALTA — Calamba.
              <br></br>
              This project is non-profit, and the final build will be open-sourced on GitHub.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
