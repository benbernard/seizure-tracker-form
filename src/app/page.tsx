import { auth } from "@/lib/clerk";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/settings");
  }

  return (
    <div className="min-h-screen bg-zinc-800 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold">Seizure Tracker</h1>
        <p className="text-zinc-300">
          Track seizure events for a patient. If you have a patient-specific
          URL, open it to submit or view today&apos;s seizures.
        </p>
        <div className="space-y-3">
          <Link
            href="/sign-in"
            className="block w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Sign in as an admin to view patients
          </Link>
          <p className="text-sm text-zinc-400">
            Signed-in users can create patients, view history, and copy patient
            URLs.
          </p>
        </div>
      </div>
    </div>
  );
}
