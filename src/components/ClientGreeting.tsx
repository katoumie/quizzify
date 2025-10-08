"use client";

import { useEffect, useState } from "react";

export default function ClientGreeting() {
  const [name, setName] = useState("Student"); // stable first render (matches SSR)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("qz_auth");
      if (!raw) return;
      const u = JSON.parse(raw);
      setName(u?.username || u?.email || "Student");
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="text-white">
      <p className="text-sm text-white/70">Welcome back,</p>
      <div className="text-xl font-bold">{name}</div>
    </div>
  );
}
