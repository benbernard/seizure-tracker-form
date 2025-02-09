"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSettings,
  updateSettings,
  deleteAllSeizures,
  uploadSeizuresFromCSV,
} from "../actions";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNewPatient = () => {
    // TODO: Implement new patient dialog
    toast.info("New patient functionality coming soon!");
  };

  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete ALL seizure records? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const result = await deleteAllSeizures();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Successfully deleted ${result.count} seizure records!`);
      }
    } catch (error) {
      console.error("Error deleting seizures:", error);
      toast.error("Failed to delete seizures");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const text = await file.text();
      const result = await uploadSeizuresFromCSV(text);

      if (result.error) {
        toast.error(result.error);
      } else {
        const failedCount = result.failedRows?.length ?? 0;
        toast.success(
          `Successfully imported ${result.successCount} of ${result.totalRows} seizures!${
            failedCount > 0 ? ` Failed to import ${failedCount} rows.` : ""
          }`,
        );
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast.error("Failed to upload CSV file");
    } finally {
      setIsUploading(false);
      // Reset the file input
      event.target.value = "";
    }
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

          <div className="bg-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Data Management</h2>
                <p className="text-zinc-300 text-sm mt-1">
                  Delete all seizure records for the current patient
                </p>
              </div>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isDeleting ? (
                  // biome-ignore lint/a11y/useSemanticElements: <explanation>
                  <span role="status">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
                    Deleting...
                  </span>
                ) : (
                  "Delete All Records"
                )}
              </button>
            </div>
          </div>

          <div className="bg-zinc-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Import Seizure Records
                </h2>
                <p className="text-zinc-300 text-sm mt-1">
                  Upload a CSV file with seizure records to import
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white 
                    ${isUploading ? "bg-indigo-500" : "bg-indigo-600 hover:bg-indigo-700"} 
                    rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
                    cursor-pointer disabled:opacity-50`}
                >
                  {isUploading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-label="Loading indicator"
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
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg
                        className="-ml-1 mr-2 h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-label="Upload icon"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Upload CSV
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
