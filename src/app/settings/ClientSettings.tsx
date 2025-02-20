"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  deleteAllSeizures,
  getSettings,
  updateSettings,
  uploadSeizuresFromCSV,
  importSeizuresFromSheet,
  getPatients,
  listSeizures,
  listMedicationChanges,
} from "../actions";
import type { Patient, Seizure, MedicationChange } from "@/lib/aws/schema";
import PatientSelector from "../components/PatientSelector";
import { FileSpreadsheet } from "lucide-react";
import { formatPacificDateTime } from "@/lib/utils/dates";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Patient | Seizure | MedicationChange | null;
  title: string;
}

function DetailModal({ isOpen, onClose, data, title }: DetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <pre className="bg-zinc-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
          <code className="text-sm text-zinc-300">
            {JSON.stringify(data, null, 2)}
          </code>
        </pre>
      </div>
    </div>
  );
}

function DataExplorer() {
  const [selectedTable, setSelectedTable] = useState<
    "patients" | "seizures" | "medicationChanges"
  >("patients");
  const [selectedItem, setSelectedItem] = useState<
    Patient | Seizure | MedicationChange | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ["patients"],
    queryFn: getPatients,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const { data: seizures = [], isLoading: isLoadingSeizures } = useQuery({
    queryKey: ["seizures", "all", settings?.currentPatientId],
    queryFn: async () => {
      if (!settings?.currentPatientId) return [];
      const result = await listSeizures(0, Math.floor(Date.now() / 1000));
      return result.seizures || [];
    },
    enabled: !!settings?.currentPatientId,
  });

  const { data: medicationChanges = [], isLoading: isLoadingMedChanges } =
    useQuery({
      queryKey: ["medicationChanges", "all", settings?.currentPatientId],
      queryFn: async () => {
        if (!settings?.currentPatientId) return [];
        const result = await listMedicationChanges(settings.currentPatientId);
        return result.medicationChanges || [];
      },
      enabled: !!settings?.currentPatientId,
    });

  const renderTableData = () => {
    if (selectedTable === "patients") {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-600">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-600">
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  onClick={() => {
                    setSelectedItem(patient);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer hover:bg-zinc-600/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {patient.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {patient.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {new Date(patient.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (selectedTable === "seizures") {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-600">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-600">
              {seizures.map((seizure) => (
                <tr
                  key={seizure.date}
                  onClick={() => {
                    setSelectedItem(seizure);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer hover:bg-zinc-600/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {`${formatPacificDateTime(seizure.date).dateStr} ${formatPacificDateTime(seizure.date).timeStr}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {seizure.duration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {seizure.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (selectedTable === "medicationChanges") {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-600">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Medication
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Dosage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-600">
              {medicationChanges.map((change) => (
                <tr
                  key={`${change.date}-${change.medication}`}
                  onClick={() => {
                    setSelectedItem(change);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer hover:bg-zinc-600/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {`${formatPacificDateTime(change.date).dateStr} ${formatPacificDateTime(change.date).timeStr}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {change.medication}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {change.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {change.dosage}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                    {change.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  const isLoading =
    isLoadingPatients || isLoadingSeizures || isLoadingMedChanges;

  return (
    <div className="bg-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Data Explorer</h2>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setSelectedTable("patients")}
          className={`px-4 py-2 rounded ${
            selectedTable === "patients"
              ? "bg-indigo-600 text-white"
              : "bg-zinc-600 text-zinc-300 hover:bg-zinc-500"
          }`}
        >
          Patients
        </button>
        <button
          onClick={() => setSelectedTable("seizures")}
          className={`px-4 py-2 rounded ${
            selectedTable === "seizures"
              ? "bg-indigo-600 text-white"
              : "bg-zinc-600 text-zinc-300 hover:bg-zinc-500"
          }`}
        >
          Seizures
        </button>
        <button
          onClick={() => setSelectedTable("medicationChanges")}
          className={`px-4 py-2 rounded ${
            selectedTable === "medicationChanges"
              ? "bg-indigo-600 text-white"
              : "bg-zinc-600 text-zinc-300 hover:bg-zinc-500"
          }`}
        >
          Medication Changes
        </button>
      </div>
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto" />
          <p className="mt-2 text-zinc-300">Loading data...</p>
        </div>
      ) : (
        renderTableData()
      )}
      <DetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        data={selectedItem}
        title={`${selectedTable.charAt(0).toUpperCase() + selectedTable.slice(1)} Details`}
      />
    </div>
  );
}

export default function ClientSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const [isImporting, setIsImporting] = useState(false);

  const handleToggle = async () => {
    try {
      setIsUpdating(true);
      const result = await updateSettings({
        enableLatenode: !settings?.enableLatenode,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
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

  const handleSheetImport = async () => {
    if (
      !window.confirm(
        "Are you sure you want to import all seizures from the Google Sheet? This may create duplicates if records already exist.",
      )
    ) {
      return;
    }

    try {
      setIsImporting(true);
      const result = await importSeizuresFromSheet();
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
      console.error("Error importing from sheet:", error);
      toast.error("Failed to import from Google Sheet");
    } finally {
      setIsImporting(false);
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
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-75 disabled:cursor-not-allowed min-w-[140px] justify-center"
              >
                {isDeleting ? (
                  <>
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
                  </>
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
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSheetImport}
                  disabled={isImporting}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white 
                    ${isImporting ? "bg-indigo-500" : "bg-indigo-600 hover:bg-indigo-700"} 
                    rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
                    disabled:opacity-50 min-w-[140px] justify-center whitespace-nowrap`}
                >
                  {isImporting ? (
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
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="-ml-1 mr-2 h-5 w-5" />
                      Import from Sheet
                    </>
                  )}
                </button>
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
                    cursor-pointer disabled:opacity-50 min-w-[140px] justify-center`}
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

          <DataExplorer />
        </div>
      </div>
    </div>
  );
}
