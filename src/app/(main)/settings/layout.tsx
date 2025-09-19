// /src/app/(main)/settings/layout.tsx
export const metadata = {
  title: "Settings – Quizzify",
  description: "Manage your profile and app preferences.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No <html> or <body> here; root layout provides them.
  // (main)/layout.tsx will wrap this with the AppShell.
  return <>{children}</>;
}
