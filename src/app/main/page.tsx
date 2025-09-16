import AppShell from "@/components/AppShell";

export default function MainPage() {
  return (
    <AppShell>
      <div className="rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur">
        <h1 className="text-xl font-bold text-white">Welcome to your Dashboard</h1>
        <p className="mt-2 text-slate-300">This is a placeholder. Your dashboard content goes here.</p>
      </div>
    </AppShell>
  );
}