// /src/app/signup/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Legacy support: /signup?mode=signin -> /signin
  useEffect(() => {
    const qpMode = (searchParams.get("mode") || "").toLowerCase();
    if (qpMode === "signin") {
      const email = searchParams.get("email");
      router.replace("/signin" + (email ? `?email=${encodeURIComponent(email)}` : ""));
    }
  }, [router, searchParams]);

  return <AuthForm mode="signup" />;
}
