"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettings, updateSettings } from "../actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import PatientSelector from "../components/PatientSelector";

export default function ClientSettings() {
  const router = useRouter();
  const {
    data: settings,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    refetchOnWindowFocus: true,
  });

  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    try {
      setIsUpdating(true);
      const result = await updateSettings({
        enableLatenode: !settings?.enableLatenode,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settings updated successfully!");
      }
    } catch (error) {
      console.error("BENBEN: Error updating settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNewPatient = () => {
    // TODO: Implement new patient dialog
    toast.info("New patient functionality coming soon!");
  };

  if (isLoading) {
    return <div className="p-4">Loading settings...</div>;
  }

  if (isError || !settings) {
    return (
      <div className="p-4 text-red-500">
        Error loading settings:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-800 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mr-4 p-2 hover:text-gray-300"
            aria-label="Back"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-700 rounded-lg p-6">
            <div className="flex flex-col space-y-4">
              <PatientSelector settings={settings} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNewPatient}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    role="img"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  New Patient
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Latenode Webhook</h2>
                <p className="text-zinc-300 text-sm mt-1">
                  Enable or disable sending seizure data to Latenode webhook
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.enableLatenode}
                  onChange={handleToggle}
                  disabled={isUpdating}
                />
                <div
                  className={`w-11 h-6 bg-zinc-600 peer-focus:outline-none peer-focus:ring-4 
                  peer-focus:ring-blue-800 rounded-full peer 
                  peer-checked:after:translate-x-full peer-checked:after:border-white 
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                  after:bg-white after:border-zinc-300 after:border after:rounded-full 
                  after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
