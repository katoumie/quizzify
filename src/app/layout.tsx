import type { Metadata } from "next";
import { Geist_Mono, Inter, Poppins, Fredoka, Baloo_2 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

// Display fonts for big, playful headings
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-fredoka",
});
const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display-baloo2",
});

export const metadata: Metadata = {
  title: "Quizzify",
  description: "Optimize your learning with Quizzify",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // We intentionally let the client add the theme class; suppress mismatch warnings here.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Early theme class injection (runs before React hydrates) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var raw = localStorage.getItem("qz_auth");
    var cls = "theme-default";
    if (raw) {
      var u = JSON.parse(raw);
      if (u && u.email && String(u.email).toLowerCase().endsWith("@perpetual.edu.ph")) {
        cls = "theme-perpetual";
      }
    }
    var root = document.documentElement;
    if (!root.classList.contains(cls)) root.classList.add(cls);
  } catch (e) {
    document.documentElement.classList.add("theme-default");
  }
})();
            `,
          }}
        />
      </head>
      <body
        className={[
          inter.variable,
          poppins.variable,
          geistMono.variable,
          fredoka.variable, // expose Fredoka
          baloo2.variable,  // expose Baloo 2
          "font-[var(--font-poppins)] antialiased",
        ].join(" ")}
        style={{ background: "var(--bg)" }}
      >
        {children}
      </body>
    </html>
  );
}
