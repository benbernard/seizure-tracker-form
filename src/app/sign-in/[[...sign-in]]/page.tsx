"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <div className="min-h-screen bg-zinc-800 flex flex-col items-center justify-center gap-4">
      <Link
        href="/"
        className="px-4 py-2 text-white bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
      >
        ← Back to App
      </Link>
      <SignIn fallbackRedirectUrl={redirectUrl || "/"} />
    </div>
  );
}
