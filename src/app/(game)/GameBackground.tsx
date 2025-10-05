// src/app/(game)/GameBackground.tsx
"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Balatro = dynamic(() => import("@/components/Balatro"), { ssr: false });

export default function GameBackground() {
  const pathname = usePathname();
  // hide Balatro on /duels/<code>/arena
  const isArena = /^\/duels\/[^/]+\/arena\/?$/.test(pathname || "");
  if (isArena) return null;

  return (
    <div className="fixed inset-0 z-0">
      <Balatro
        isRotate={false}
        mouseInteraction={false}
        pixelFilter={700}
        color1="#b365d7"
        color2="#5b6be6"
        color3="#162325"
      />
    </div>
  );
}
