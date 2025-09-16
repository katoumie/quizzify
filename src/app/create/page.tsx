"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyCreateRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sets/new");
  }, [router]);
  return null;
}
