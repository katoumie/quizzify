// /src/app/(main)/u/layout.tsx
import React from "react";

export default function ULayout({ children }: { children: React.ReactNode }) {
  // Do NOT render <html> or <body> here.
  // The root layout already provides them; (main)/layout.tsx wraps with AppShell.
  return <>{children}</>;
}
