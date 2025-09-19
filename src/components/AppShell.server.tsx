// /src/components/AppShell.server.tsx
import { cookies } from "next/headers";
import React from "react";
import AppShell from "./AppShell";

export default async function AppShellServer({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isCompact = cookieStore.get("qz_sidebar_compact")?.value === "1";
  return <AppShell initialCompact={isCompact}>{children}</AppShell>;
}
