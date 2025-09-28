// src/app/fonts.ts
import localFont from "next/font/local";

export const ritasmith = localFont({
  src: [
    {
      // path is file-system relative to THIS file
      path: "../../public/fonts/ritasmith/ritasmith.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-ritasmith", // exposes a CSS variable
  preload: true,
});
