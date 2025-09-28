// src/app/(game)/layout.tsx
import GameBackground from "./GameBackground";
import { ritasmith } from "@/app/fonts";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 overflow-hidden text-white ${ritasmith.variable}`}>
      <GameBackground />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
