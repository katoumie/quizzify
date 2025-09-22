// /src/app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono, Mona_Sans, Fredoka, Baloo_2 } from "next/font/google";
import "./globals.css"; // <-- root uses "./"
import { cookies } from "next/headers";
import React from "react";

const mona = Mona_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-mona",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-fredoka",
  display: "swap",
});
const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-baloo2",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quizzify",
  description: "Optimize your learning with Quizzify",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Keep sidebar vars consistent (harmless on landing pages)
  const cookieStore = await cookies();
  const isCompact = cookieStore.get("qz_sidebar_compact")?.value === "1";

  const SIDEBAR_FULL = "240px";
  const SIDEBAR_COMPACT = "72px";

  return (
    <html
      lang="en"
      className={[mona.variable, geistMono.variable, fredoka.variable, baloo2.variable, "dark"].join(" ")}
      data-sidebar-compact={isCompact ? "1" : "0"}
      style={
        {
          ["--sidebar-w" as any]: isCompact ? SIDEBAR_COMPACT : SIDEBAR_FULL,
        } as React.CSSProperties
      }
    >
      <head>
        <style id="qz-vars">{`
          :root { --sidebar-w: ${SIDEBAR_FULL}; }
          html[data-sidebar-compact="1"] { --sidebar-w: ${SIDEBAR_COMPACT}; }
        `}</style>
        <style id="qz-compact-hide">{`
          html[data-sidebar-compact="1"] .qz-hide-when-compact { display: none !important; }
        `}</style>
      </head>
      <body
        className={[
          "min-h-screen bg-[var(--bg)] text-[var(--foreground)] antialiased",
          "[font-family:var(--font-mona),system-ui,-apple-system,Segoe_UI,Roboto,Ubuntu,Cantarell,Noto_Sans,'Helvetica Neue',Arial,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol',sans-serif]",
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}
