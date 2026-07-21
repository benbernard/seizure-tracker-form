import { isLocalAuth } from "@/lib/clerk";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignUpClient from "./SignUpClient";

export default function SignUpPage() {
  if (isLocalAuth()) {
    redirect("/settings");
  }

  return (
    <div className="min-h-screen bg-zinc-800 flex flex-col items-center justify-center gap-4">
      <Link
        href="/"
        className="px-4 py-2 text-white bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
      >
        ← Back to App
      </Link>
      <SignUpClient />
    </div>
  );
}
