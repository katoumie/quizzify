// /src/app/(game)/GameBackground.tsx
"use client";

import dynamic from "next/dynamic";

// Import Balatro on the client (it uses canvas/window)
const Balatro = dynamic(() => import("@/components/Balatro"), { ssr: false });

export default function GameBackground() {
  return (
    <div className="fixed inset-0 -z-10">

      <Balatro
        isRotate={false}
        mouseInteraction={false}
        pixelFilter={700}

      />

    </div>
  );
}
