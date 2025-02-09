"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function VercelGreeting() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hello")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch greeting");
        }
        return response.json();
      })
      .then((data) => {
        setGreeting(data.message);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <p>Loading greeting...</p>;
  if (error) return <p>Error: {error}</p>;

  return <p className="text-xl font-semibold mt-4">{greeting}</p>;
}

export default function Home() {
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const submitSeizure = async (duration: string, notes: string) => {
    setLoading(true);
    try {
      await axios.post(
        "https://webhook.latenode.com/11681/prod/84908c3c-1283-4f18-9ef3-d773bd08ad6e",
        {
          duration,
          notes: `WebForm: ${notes.trim()}`,
        },
      );
      toast.success("Seizure logged!");
      setDuration("");
      setNotes("");
    } catch (error) {
      toast.error("Failed to submit data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitSeizure(duration, notes);
  };

  return (
    <div className="min-h-screen min-w-[300px] bg-zinc-800 font-normal text-white leading-6 text-opacity-90">
      <div className="flex min-h-screen justify-center p-4 pt-10">
        <div className="w-full max-w-[800px]">
          <div className="mb-4 text-center font-bold text-2xl">
            Kat Seizure Tracking From Next.js
          </div>
          <VercelGreeting />
          <div className="mt-4">
            <div className="mx-auto max-w-md border border-zinc-600 rounded-lg p-4">
              <div className="flex gap-2 flex-wrap justify-between">
                {[5, 10, 15, 20].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => submitSeizure(seconds.toString(), notes)}
                    disabled={loading}
                    className="px-4 py-2 bg-green-700 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-md"
                  required
                />
                <button
                  type="submit"
                  className="mt-1 inline-flex justify-center rounded-md border border-transparent bg-green-700 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  disabled={loading}
                >
                  {loading ? (
                    <svg
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
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-md"
                rows={4}
              />
            </div>
          </form>
        </div>
      </div>
      <ToastContainer position="bottom-center" />
    </div>
  );
}
