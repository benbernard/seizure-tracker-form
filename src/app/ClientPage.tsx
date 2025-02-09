"use client";

import { useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import { useFormStatus } from "react-dom";
import { submitSeizure } from "./actions";
import SeizuresList from "./components/SeizuresList";
import { queryClient } from "./QueryProvider";
import { toast } from "react-toastify";
import type { Settings } from "@/lib/aws/schema";
import { useRouter } from "next/navigation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="mt-1 inline-flex h-[45px] items-center justify-center rounded-md border border-transparent bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      disabled={pending}
    >
      {pending ? (
        <svg
          role="img"
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        "Submit"
      )}
    </button>
  );
}

function QuickButton({
  seconds,
  disabled,
  formAction,
}: {
  seconds: number;
  disabled: boolean;
  formAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  console.log(
    `BENBEN QuickButton rendering for ${seconds}s, disabled: ${disabled}, pending: ${pending}`,
  );

  return (
    <button
      type="submit"
      formAction={() => {
        const formData = new FormData();
        formData.set("duration", seconds.toString());
        formData.set("notes", "QuickAction");
        formAction(formData);
      }}
      disabled={disabled || pending}
      className="inline-flex h-10 w-16 items-center justify-center rounded-md bg-green-700 transition-colors hover:bg-green-600 disabled:opacity-50"
    >
      {pending ? (
        <svg
          role="img"
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        `${seconds}s`
      )}
    </button>
  );
}

export default function ClientPage({
  initialSettings,
}: {
  initialSettings: Settings;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);

  async function handleSubmit(formData: FormData) {
    const duration = formData.get("duration") as string;
    const notes = formData.get("notes") as string;

    if (notes !== "QuickAction" && (!duration || Number(duration) === 0)) {
      setIsInvalid(true);
      toast.error("Duration is required for manual submissions");
      return;
    }
    setIsInvalid(false);

    const processedNotes =
      notes === "QuickAction" ? notes : notes ? `WebForm: ${notes}` : undefined;

    const result = await submitSeizure(duration, processedNotes);

    if (result.success) {
      toast.success("Seizure logged!");
      setDuration("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["seizures"] });
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
              {initialSettings.currentPatientId?.toUpperCase() || "Kat"} Seizure
              Tracker
            </h1>
            <button
              type="button"
              className="absolute right-0 top-0 p-2 hover:text-gray-300"
              onClick={() => router.push("/settings")}
              aria-label="Settings"
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          <form action={handleSubmit} className="space-y-4">
            <div className="mt-4">
              <div className="mx-auto max-w-md rounded-lg border border-zinc-600 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  {[5, 10, 15, 20].map((seconds) => (
                    <QuickButton
                      key={seconds}
                      seconds={seconds}
                      disabled={false}
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

          <SeizuresList />
        </div>
      </div>
    </div>
  );
}
