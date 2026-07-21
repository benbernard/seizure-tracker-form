"use client";

import type { MedicationChange, Patient, Seizure } from "@/lib/aws/schema";
import { SignOutButton } from "@/lib/clerk-client";
import { copyText } from "@/lib/utils/clipboard";
import { formatPacificDateTime } from "@/lib/utils/dates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  addPatientOwner,
  createPatient,
  deleteAllSeizures,
  getPatientOwnerEmails,
  getPatients,
  getSettings,
  listMedicationChanges,
  listSeizures,
  removePatientOwner,
  updatePatientQuickButtons,
  updateSettings,
  uploadSeizuresFromCSV,
} from "../actions";
import PatientSelector from "../components/PatientSelector";

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

interface PatientOwnerManagementProps {
  patientId: string;
  patients: Patient[];
  onUpdate: () => void;
}

interface OwnerEntry {
  userId: string;
  email: string;
  isCurrentUser: boolean;
  isOwner: boolean;
}

export function PatientOwnerManagement({
  patientId,
  patients,
  onUpdate,
}: PatientOwnerManagementProps) {
  const patient = patients.find((p) => p.id === patientId);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    data: ownerData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["patientOwners", patientId],
    queryFn: async () => {
      const result = await getPatientOwnerEmails(patientId);
      return result;
    },
    enabled: !!patientId,
  });

  if (!patient) return null;

  const owners = (ownerData?.owners as OwnerEntry[] | undefined) ?? [];

  const handleAdd = async () => {
    const trimmed = newOwnerEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("A valid email address is required");
      return;
    }
    setIsSubmitting(true);
    const result = await addPatientOwner(patientId, trimmed);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Owner added");
      setNewOwnerEmail("");
      onUpdate();
      refetch();
    }
    setIsSubmitting(false);
  };

  const handleRemove = async (ownerId: string) => {
    setIsSubmitting(true);
    const result = await removePatientOwner(patientId, ownerId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Owner removed");
      onUpdate();
      refetch();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Patient Owners</h2>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <input
            type="email"
            value={newOwnerEmail}
            onChange={(e) => setNewOwnerEmail(e.target.value)}
            placeholder="Email address to add"
            className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isSubmitting || !newOwnerEmail.trim()}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add Owner"}
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-zinc-400">Loading owners...</p>
        ) : owners.length === 0 ? (
          <p className="text-sm text-zinc-400">No owners found.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {owners.map((owner) => (
                <li
                  key={owner.userId}
                  className="flex items-center justify-between bg-zinc-800 rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300">{owner.email}</span>
                    {owner.isCurrentUser && (
                      <span className="text-xs bg-zinc-600 text-white px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                    {owner.isOwner && (
                      <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">
                        Owner
                      </span>
                    )}
                  </div>
                  {!owner.isOwner && (
                    <button
                      type="button"
                      onClick={() => handleRemove(owner.userId)}
                      disabled={isSubmitting}
                      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {owners.filter((owner) => !owner.isOwner).length === 0 && (
              <p className="text-sm text-zinc-400">No additional owners.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AccessCard({
  title,
  description,
  url,
  copyUrl,
  copyLabel,
  openLabel,
  isExternal,
  icon,
}: {
  title: string;
  description: string;
  url: string;
  copyUrl?: string;
  copyLabel: string;
  openLabel: string;
  isExternal: boolean;
  icon: React.ReactNode;
}) {
  const linkToCopy = copyUrl ?? url;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <p className="text-xs text-zinc-400">{description}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => copyText(linkToCopy)}
          aria-label={copyLabel}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-zinc-600 rounded-md hover:bg-zinc-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy link
        </button>
        {isExternal ? (
          <button
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            aria-label={openLabel}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            {icon}
            Open
          </button>
        ) : (
          <Link
            href={url}
            aria-label={openLabel}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            {icon}
            Open
          </Link>
        )}
      </div>
    </div>
  );
}

function PublicPatientLink({ patientId }: { patientId?: string | null }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!patientId) {
    return (
      <p className="text-sm text-zinc-400">
        Select a patient to see the public link.
      </p>
    );
  }

  const url = `${origin}/p/${patientId}`;

  return (
    <AccessCard
      title="Public page"
      description="Anyone with this link can view this patient&apos;s page"
      url={url}
      copyLabel="Copy public link"
      openLabel="Open public page"
      isExternal
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      }
    />
  );
}

function HistoryMedsLink({ patientId }: { patientId?: string | null }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!patientId) {
    return (
      <p className="text-sm text-zinc-400">
        Select a patient to view history and medication.
      </p>
    );
  }

  const fullUrl = `${origin}/graphs`;

  return (
    <AccessCard
      title="History &amp; Meds"
      description="Charts and medication changes for this patient"
      url="/graphs"
      copyUrl={fullUrl}
      copyLabel="Copy history and medication link"
      openLabel="Open history and medication page"
      isExternal={false}
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 mr-1"
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
      }
    />
  );
}

interface QuickButtonItem {
  id: number;
  value: number;
}

function QuickButtonSettings({
  patientId,
  seconds,
  onUpdate,
}: {
  patientId: string;
  seconds?: number[];
  onUpdate: () => void;
}) {
  const nextId = useRef(1);
  const initialItems = (seconds?.length ? seconds : [5, 10, 15, 20]).map(
    (value, index) => {
      nextId.current = Math.max(nextId.current, index + 2);
      return { id: index + 1, value };
    },
  );
  const [items, setItems] = useState<QuickButtonItem[]>(initialItems);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const nextItems = (seconds?.length ? seconds : [5, 10, 15, 20]).map(
      (value, index) => {
        nextId.current = Math.max(nextId.current, index + 2);
        return { id: index + 1, value };
      },
    );
    setItems(nextItems);
  }, [seconds]);

  const updateValue = (id: number, value: string) => {
    const num = Number(value);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, value: Number.isNaN(num) ? 0 : num } : item,
      ),
    );
  };

  const addButton = () => {
    setItems((prev) =>
      prev.length >= 6 ? prev : [...prev, { id: nextId.current++, value: 30 }],
    );
  };

  const removeButton = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    const valid = items
      .map((item) => Number(item.value))
      .filter((s) => Number.isInteger(s) && s > 0);
    if (valid.length === 0) {
      toast.error("At least one positive duration is required");
      return;
    }
    if (valid.length > 6) {
      toast.error("At most 6 quick buttons are allowed");
      return;
    }
    setIsSaving(true);
    const result = await updatePatientQuickButtons(patientId, valid);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Quick buttons updated");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      onUpdate();
    }
    setIsSaving(false);
  };

  return (
    <div className="pt-4 border-t border-zinc-600">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-zinc-200">
          Quick seizure buttons
        </h3>
        <p className="text-xs text-zinc-400">
          Durations shown on the public page for quick logging
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              step={1}
              value={item.value}
              onChange={(e) => updateValue(item.id, e.target.value)}
              className="w-20 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              aria-label={`Quick button ${index + 1} duration in seconds`}
            />
            <span className="text-sm text-zinc-400">s</span>
            <button
              type="button"
              onClick={() => removeButton(item.id)}
              disabled={items.length <= 1}
              aria-label={`Remove quick button ${index + 1}`}
              className="ml-1 text-zinc-400 hover:text-red-400 disabled:opacity-30"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addButton}
          disabled={items.length >= 6}
          aria-label="Add quick button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-zinc-600 text-white hover:bg-zinc-500 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="ml-auto inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
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

  const currentPatientId = settings?.currentPatientId;
  const currentPatient = patients.find((p) => p.id === currentPatientId);

  const { data: seizures = [], isLoading: isLoadingSeizures } = useQuery({
    queryKey: ["seizures", "all", currentPatientId],
    queryFn: async () => {
      if (!currentPatientId) return [];
      const result = await listSeizures(
        currentPatientId,
        0,
        Math.floor(Date.now() / 1000),
      );
      return result.seizures || [];
    },
    enabled: !!currentPatientId,
  });

  const { data: medicationChanges = [], isLoading: isLoadingMedChanges } =
    useQuery({
      queryKey: ["medicationChanges", "all", currentPatientId],
      queryFn: async () => {
        if (!currentPatientId) return [];
        const result = await listMedicationChanges(currentPatientId);
        return result.medicationChanges || [];
      },
      enabled: !!currentPatientId,
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
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Data Explorer</h2>
        <p className="text-zinc-300 text-sm">
          {currentPatient
            ? `Showing data for ${currentPatient.name}`
            : "Select a patient to explore its data"}
        </p>
      </div>
      {!currentPatientId ? (
        <p className="text-sm text-zinc-400">
          No patient selected. Choose a patient above to view records.
        </p>
      ) : (
        <>
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
        </>
      )}
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

  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  const { data: patients = [], refetch: refetchPatients } = useQuery({
    queryKey: ["patients"],
    queryFn: getPatients,
  });

  const handleNewPatient = async () => {
    const name = newPatientName.trim();
    if (!name) {
      toast.error("Patient name is required");
      return;
    }

    try {
      setIsCreatingPatient(true);
      const result = await createPatient(name);
      if (result.error || !result.patient) {
        toast.error(result.error || "Failed to create patient");
      } else {
        toast.success(`Patient "${result.patient.name}" created`);
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        setNewPatientName("");
        setShowNewPatientForm(false);
      }
    } catch (error) {
      console.error("Error creating patient:", error);
      toast.error("Failed to create patient");
    } finally {
      setIsCreatingPatient(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!settings?.currentPatientId) {
      toast.error("No patient selected");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to delete ALL seizure records for this patient? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const result = await deleteAllSeizures(settings.currentPatientId);
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

    if (!settings?.currentPatientId) {
      toast.error("No patient selected");
      return;
    }

    try {
      setIsUploading(true);
      const text = await file.text();
      const result = await uploadSeizuresFromCSV(
        settings.currentPatientId,
        text,
      );

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
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
          <SignOutButton>
            <button className="px-4 mt-2 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
              Sign Out
            </button>
          </SignOutButton>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-700 rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Current Patient</h2>
              <p className="text-zinc-300 text-sm">
                Select the patient to track and share the public link
              </p>
            </div>
            <div className="flex flex-col space-y-4">
              <PatientSelector settings={settings} showHeader={false} />
              {!showNewPatientForm ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewPatientForm(true)}
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
              ) : (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="new-patient-name"
                    className="text-sm text-zinc-300"
                  >
                    Patient name
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="new-patient-name"
                      type="text"
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleNewPatient}
                      disabled={isCreatingPatient}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isCreatingPatient ? "Creating..." : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewPatientForm(false);
                        setNewPatientName("");
                      }}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-zinc-600 rounded-md hover:bg-zinc-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-zinc-600">
                <h3 className="text-sm font-medium text-zinc-200 mb-3">
                  Patient access
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <PublicPatientLink patientId={settings.currentPatientId} />
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <HistoryMedsLink patientId={settings.currentPatientId} />
                  </div>
                </div>
              </div>
              {settings.currentPatientId && (
                <QuickButtonSettings
                  patientId={settings.currentPatientId}
                  seconds={
                    patients.find((p) => p.id === settings.currentPatientId)
                      ?.quickButtonSeconds
                  }
                  onUpdate={() => {}}
                />
              )}
            </div>
          </div>

          {settings?.currentPatientId && (
            <PatientOwnerManagement
              patientId={settings.currentPatientId}
              patients={patients}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ["patients"] });
                refetchPatients();
              }}
            />
          )}

          <div className="bg-zinc-700 rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Data Management</h2>
              <p className="text-zinc-300 text-sm">
                Delete or import seizure records for the current patient
              </p>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">
                    Delete all records
                  </h3>
                  <p className="text-zinc-400 text-xs">
                    Remove every seizure record for the current patient
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

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">
                    Import records
                  </h3>
                  <p className="text-zinc-400 text-xs">
                    Upload a CSV file with seizure records
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isUploading || !settings?.currentPatientId}
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
          </div>

          <DataExplorer />
        </div>
      </div>
    </div>
  );
}
