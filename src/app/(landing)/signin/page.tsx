// /src/app/signin/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Legacy support: /signin?mode=signup -> /signup
  useEffect(() => {
    const qpMode = (searchParams.get("mode") || "").toLowerCase();
    if (qpMode === "signup") {
      const email = searchParams.get("email");
      router.replace("/signup" + (email ? `?email=${encodeURIComponent(email)}` : ""));
    }
  }, [router, searchParams]);

  return <AuthForm mode="signin" />;
}
