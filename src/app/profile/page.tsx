"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
const SESSION_KEY = "qz_auth";

export default function ProfilePage() {
  const router = useRouter();
  useEffect(() => {
    if (!localStorage.getItem(SESSION_KEY)) router.replace("/signin");
  }, [router]);

  return (
    <section className="pt-8 pb-16 md:pt-12 md:pb-20">
      <div className="container mx-auto px-4">
        <h1 className="h2">Profile</h1>
        <p className="mt-2 text-slate-300">This page is a placeholder for now.</p>
      </div>
    </section>
  );
}
