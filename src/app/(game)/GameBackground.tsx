// /src/app/(game)/GameBackground.tsx
"use client";
import dynamic from "next/dynamic";
const Balatro = dynamic(() => import("@/components/Balatro"), { ssr: false });

export default function GameBackground() {
  return (
    // was: -z-10 —> change to z-0 so it's not behind the parent
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
