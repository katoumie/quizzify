// /src/app/(game)/layout.tsx
import Image from "next/image";
import GameBackground from "./GameBackground";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh text-white">
      {/* Full-viewport Balatro background (client component) */}
      <GameBackground />

      {/* Fixed top logo (no translucent card) */}
      <header className="fixed inset-x-0 top-0 z-10 flex justify-center pointer-events-none">
        <Image
          src="/logo-pixelated.png"
          alt="Quizzify"
          width={500}       // tweak as needed
          height={500}
          priority
          className="mt-4 block drop-shadow" // subtle separation from background
        />
      </header>

      {/* Push content below the fixed header */}
      <div className="relative pt-20">
        {children}
      </div>
    </div>
  );
}
