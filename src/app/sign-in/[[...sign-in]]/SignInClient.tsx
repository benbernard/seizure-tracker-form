"use client";

import { SignIn } from "@/lib/clerk-client";
import { useSearchParams } from "next/navigation";

export default function SignInClient() {
  const redirectUrl = useSearchParams().get("redirect_url") || "/";
  return <SignIn fallbackRedirectUrl={redirectUrl} />;
}
