// /src/app/(main)/achievements/layout.tsx
import React from "react";

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  // Do NOT render <html> or <body> here.
  // Root /app/layout.tsx provides them; (main)/layout.tsx wraps pages with AppShell.
  return <>{children}</>;
}
