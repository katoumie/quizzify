// /src/app/(game)/layout.tsx
import GameBackground from "./GameBackground";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    // Lock the (game) area to the viewport; no page scrolling
    <div className="fixed inset-0 z-0 overflow-hidden text-white">
      {/* Full-viewport Balatro background */}
      <GameBackground />

      {/* Foreground content fills the viewport */}
      <div className="relative h-full">
        {children}
      </div>
    </div>
  );
}
