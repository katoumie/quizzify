// /src/app/(main)/layout.tsx
import React from "react";
import AppShell from "@/components/AppShell.server";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
