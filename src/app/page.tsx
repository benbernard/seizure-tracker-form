"use client";

import { useState, useActionState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useFormStatus } from "react-dom";
import { submitSeizure } from "./actions";
import SeizuresList from "./components/SeizuresList";
import { queryClient } from "./QueryProvider";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="mt-1 inline-flex justify-center rounded-md border border-transparent bg-green-700 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
      className="px-4 py-2 bg-green-700 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
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

type FormState = {
  success?: boolean;
  error?: string;
} | null;

export default function Home() {
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [, formAction] = useActionState(
    async (_prevState: FormState, formData: FormData) => {
      const duration = formData.get("duration") as string;
      const notes = formData.get("notes") as string;

      const result = await submitSeizure(duration, notes);

      if (result.success) {
        toast.success("Seizure logged!");
        setDuration("");
        setNotes("");
        queryClient.invalidateQueries({ queryKey: ["seizures"] });
      } else {
        toast.error(result.error || "Failed to submit data.");
      }

      return result;
    },
    null,
  );

  return (
    <div className="min-h-screen min-w-[300px] bg-zinc-800 font-normal text-white leading-6 text-opacity-90">
      <div className="flex min-h-screen justify-center p-4 pt-10">
        <div className="w-full max-w-[800px]">
          <div className="mb-4 text-center font-bold text-2xl">
            Kat Seizure Tracking
          </div>
          <form action={formAction} className="space-y-4">
            <div className="mt-4">
              <div className="mx-auto max-w-md border border-zinc-600 rounded-lg p-4">
                <div className="flex gap-2 flex-wrap justify-between">
                  {[5, 10, 15, 20].map((seconds) => (
                    <QuickButton
                      key={seconds}
                      seconds={seconds}
                      disabled={false}
                      formAction={formAction}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex mt-4 flex-col text-left">
              <label
                htmlFor="duration"
                className="block font-medium text-sm text-white"
              >
                Duration (seconds)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-md"
                />
                <SubmitButton />
              </div>
            </div>
            <div className="flex flex-col">
              <label
                htmlFor="notes"
                className="block text-left font-medium text-sm text-white"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-md"
                rows={4}
              />
            </div>
          </form>
          <SeizuresList />
        </div>
      </div>
      <ToastContainer position="bottom-center" />
    </div>
  );
}
