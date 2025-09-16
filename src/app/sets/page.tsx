"use client";

import AppShell from "@/components/AppShell";
import SetForm from "@/components/SetForm";

export default function NewSetPage() {
  return (
    <AppShell>
      <SetForm mode="create" />
    </AppShell>
  );
}
