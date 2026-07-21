"use client";

import { SignUp } from "@/lib/clerk-client";
import { useSearchParams } from "next/navigation";

export default function SignUpClient() {
  const redirectUrl = useSearchParams().get("redirect_url") || "/";
  return <SignUp fallbackRedirectUrl={redirectUrl} />;
}
