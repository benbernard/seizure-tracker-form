"use client";

import { getTodaySeizuresPublic, submitSeizurePublic } from "@/app/actions";
import type { Seizure } from "@/lib/aws/schema";
import { useAuth } from "@/lib/clerk-client";
import { formatPacificDateTime } from "@/lib/utils/dates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "react-toastify";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="mt-1 inline-flex h-[45px] items-center justify-center rounded-md border border-transparent bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      disabled={pending}
    >
      {pending ? "Submitting..." : "Submit"}
    </button>
  );
}

function AdminLink({ patientId }: { patientId: string }) {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <Link
        href={`/p/${patientId}/settings`}
        className="text-sm text-blue-400 hover:text-blue-300"
      >
        Settings
      </Link>
    );
  }

  return (
    <Link href="/sign-in" className="text-sm text-blue-400 hover:text-blue-300">
      Sign in
    </Link>
  );
}

function QuickButton({
  seconds,
  formAction,
}: {
  seconds: number;
  formAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={() => {
        const formData = new FormData();
        formData.set("duration", seconds.toString());
        formData.set("notes", "QuickAction");
        formAction(formData);
      }}
      disabled={pending}
      className="inline-flex h-10 w-16 items-center justify-center rounded-md bg-green-700 transition-colors hover:bg-green-600 disabled:opacity-50"
    >
      {pending ? "..." : `${seconds}s`}
    </button>
  );
}

function cleanNotes(notes: string | undefined): string {
  if (!notes) return "-";
  const prefixes = [
    "WebForm: ",
    "WebForm:",
    "WebForm",
    "From HA",
    "Alexa Invocation",
    "QuickAction",
    "api",
  ];
  let cleaned = notes;
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim();
    }
  }
  return cleaned.replace(/^:/, "").trim() || "-";
}

export default function PublicPatientPage({
  patientId,
  patientName,
  quickButtonSeconds,
  initialSeizures,
}: {
  patientId: string;
  patientName: string;
  quickButtonSeconds?: number[];
  initialSeizures: Seizure[];
}) {
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const queryClient = useQueryClient();

  const quickButtons = quickButtonSeconds ?? [5, 10, 15, 20];

  const { data: seizures = initialSeizures } = useQuery({
    queryKey: ["todaySeizures", patientId],
    queryFn: async () => {
      const result = await getTodaySeizuresPublic(patientId);
      return result.seizures || [];
    },
    initialData: initialSeizures,
  });

  async function handleSubmit(formData: FormData) {
    const duration = formData.get("duration") as string;
    const notes = formData.get("notes") as string;

    const isQuickAction = notes === "QuickAction";
    if (!isQuickAction && (!duration || Number(duration) === 0)) {
      setIsInvalid(true);
      toast.error("Duration is required for manual submissions");
      return;
    }
    setIsInvalid(false);

    const processedNotes = isQuickAction
      ? notes
      : notes
        ? `WebForm: ${notes}`
        : undefined;

    const result = await submitSeizurePublic(
      patientId,
      duration,
      processedNotes,
    );

    if (result.success) {
      toast.success("Seizure logged!");
      setDuration("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["todaySeizures", patientId] });
    } else {
      toast.error(result.error || "Failed to submit data.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-800 text-white">
      <div className="flex justify-center p-4">
        <div className="w-full max-w-[800px]">
          <div className="relative mb-6">
            <h1 className="text-center text-2xl font-bold">
              {patientName} Seizure Tracker
            </h1>
            <div className="absolute right-0 -top-1 flex items-center gap-2">
              <AdminLink patientId={patientId} />
            </div>
          </div>

          <form action={handleSubmit} className="space-y-4">
            <div className="mt-4">
              <div className="mx-auto max-w-md rounded-lg border border-zinc-600 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  {quickButtons.map((seconds) => (
                    <QuickButton
                      key={seconds}
                      seconds={seconds}
                      formAction={handleSubmit}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col text-left">
              <label htmlFor="duration">Duration (seconds)</label>
              <div className="flex flex-col gap-1">
                <div className="mb-2 flex gap-2">
                  <input
                    type="number"
                    id="duration"
                    name="duration"
                    value={duration}
                    onChange={(e) => {
                      setDuration(e.target.value);
                      setIsInvalid(false);
                    }}
                    className={`mt-1 block w-full rounded-md border-2 p-2 text-black shadow-sm focus:ring-2 sm:text-md ${
                      isInvalid
                        ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    }`}
                  />
                  <SubmitButton />
                </div>
                <textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  rows={4}
                />
              </div>
            </div>
          </form>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Today&apos;s Seizures ({seizures.length})
              </h2>
              <Link
                href={`/p/${patientId}/graphs`}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="History and medication"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </Link>
            </div>
            {seizures.length === 0 ? (
              <p className="text-center text-gray-400">
                No seizures recorded today.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-collapse">
                  <thead>
                    <tr className="bg-zinc-800">
                      <th className="px-4 py-2 text-left border-b border-zinc-600">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left border-b border-zinc-600">
                        Duration
                      </th>
                      <th className="px-4 py-2 text-left border-b border-zinc-600">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {seizures.map((seizure) => {
                      const { dateStr, timeStr } = formatPacificDateTime(
                        seizure.date,
                      );
                      return (
                        <tr
                          key={seizure.date}
                          className="border-b border-zinc-700"
                        >
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {dateStr} {timeStr}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">
                              {seizure.duration}s
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {cleanNotes(seizure.notes)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
