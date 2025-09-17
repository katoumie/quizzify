// /src/app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono, Mona_Sans, Fredoka, Baloo_2 } from "next/font/google";
import "./globals.css";

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

// Display stack for playful headings
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={[mona.variable, geistMono.variable, fredoka.variable, baloo2.variable].join(" ")}>
      <body
        className={[
          // base body styling
          "min-h-screen bg-[var(--bg)] text-[var(--foreground)] antialiased",
          // use Mona Sans everywhere by default
          "[font-family:var(--font-mona),system-ui,-apple-system,Segoe_UI,Roboto,Ubuntu,Cantarell,Noto_Sans,'Helvetica Neue',Arial,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol',sans-serif]",
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}
