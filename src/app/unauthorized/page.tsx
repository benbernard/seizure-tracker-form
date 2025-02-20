"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function UnauthorizedPage() {
  const { isLoaded, isSignedIn, signOut } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-800 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-700 p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-4">
          Unauthorized Access
        </h1>
        <p className="text-zinc-300 mb-6">
          Your email address is not on the allowlist for this application.
          Please contact the administrator if you believe this is an error.
        </p>
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="inline-block text-center px-4 py-2 bg-zinc-600 text-white rounded hover:bg-zinc-500 transition-colors"
          >
            Return Home
          </Link>
          {isSignedIn && (
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
