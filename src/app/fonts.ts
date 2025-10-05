// src/app/fonts.ts
import localFont from "next/font/local";

export const ritasmith = localFont({
  src: [{ path: "../../public/fonts/ritasmith/ritasmith.woff2", weight: "400", style: "normal" }],
  display: "swap",
  variable: "--font-ritasmith",
  preload: true,
});

// NEW: Continuum (light/medium/bold)
export const continuum = localFont({
  src: [
    { path: "../../public/fonts/continuum/contl.ttf", weight: "300", style: "normal" }, // light
    { path: "../../public/fonts/continuum/contm.ttf", weight: "500", style: "normal" }, // medium
    { path: "../../public/fonts/continuum/contb.ttf", weight: "700", style: "normal" }, // bold
  ],
  display: "swap",
  variable: "--font-continuum", // lets us use Tailwind utility if desired
  preload: true,
});
