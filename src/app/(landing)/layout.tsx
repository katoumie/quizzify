// /src/app/(landing)/layout.tsx
import React from "react";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  // Keep this minimal so landing routes don't get the AppShell.
  // Root /app/layout.tsx already sets <html>, <body>, fonts, and globals.css.
  return <>{children}</>;
}
