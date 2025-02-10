"use client";

import type { Seizure } from "@/lib/aws/schema";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, FileSpreadsheet, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";
import { deleteSeizure, listSeizures } from "../actions";
import {
  formatPacificDateTime,
  getCurrentPacificDayStartTimestamp,
} from "@/lib/utils/dates";

function DeleteButton({
  onClick,
  isDeleting,
}: { onClick: () => void; isDeleting: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={isDeleting}
      className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-400/10 disabled:opacity-50 w-8 h-8 flex items-center justify-center"
      title="Delete seizure record"
    >
      {isDeleting ? (
        <svg
          className="animate-spin h-4 w-4"
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
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  );
}

// Helper function to clean notes of common prefixes
function cleanNotes(notes: string | undefined): string {
  if (!notes) return "-";

  // List of prefixes to remove
  const prefixesToRemove = [
    "WebForm: ",
    "WebForm:",
    "WebForm",
    "From HA",
    "Alexa Invocation",
    "QuickAction",
    "api",
  ];

  let cleanedNotes = notes;
  for (const prefix of prefixesToRemove) {
    if (cleanedNotes.startsWith(prefix)) {
      cleanedNotes = cleanedNotes.slice(prefix.length).trim();
    }
  }

  // If after cleaning we have an empty string or just a colon, return '-'
  return cleanedNotes.replace(/^:/, "").trim() || "-";
}

function SeizuresList() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);

  const {
    data: todaySeizures = [],
    error: todayError,
    isLoading: isTodayLoading,
    isError: isTodayError,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ["seizures", "today"],
    queryFn: async () => {
      const startOfDay = getCurrentPacificDayStartTimestamp();
      const result = await listSeizures(startOfDay);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.seizures || [];
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 3,
  });

  const {
    data: olderSeizures = [],
    error: olderError,
    isLoading: isOlderLoading,
    isError: isOlderError,
  } = useQuery({
    queryKey: ["seizures", "older", oldestTimestamp],
    queryFn: async () => {
      const startOfDay = getCurrentPacificDayStartTimestamp();
      const endTime = oldestTimestamp || startOfDay;

      const result = await listSeizures(0, endTime - 1); // Subtract 1 second to exclude current oldest
      if (result.error) {
        throw new Error(result.error);
      }

      const seizures = result.seizures || [];
      return seizures.slice(0, 100);
    },
    enabled: !!oldestTimestamp, // Only load older seizures when we have a timestamp
    retry: 3,
  });

  if (isTodayLoading) {
    return <p className="text-center mt-4">Loading seizures...</p>;
  }

  if (isTodayError) {
    return (
      <div className="text-center mt-4">
        <p className="text-red-500 mb-2">
          {todayError instanceof Error
            ? todayError.message
            : "Failed to load seizures"}
        </p>
        <button
          type="button"
          onClick={() => refetchToday()}
          className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const handleDelete = async (seizure: Seizure) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this seizure record? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(seizure.date);
    try {
      const result = await deleteSeizure(seizure.date);
      if (result.success) {
        toast.success("Seizure record deleted");
        queryClient.invalidateQueries({ queryKey: ["seizures"] });
      } else {
        toast.error(result.error || "Failed to delete seizure");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const seizures = [...todaySeizures, ...olderSeizures];
  const startOfDay = getCurrentPacificDayStartTimestamp();
  const displayTimestamp = oldestTimestamp || startOfDay;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>Recent Seizures ({seizures.length})</span>
          <a
            href="https://docs.google.com/spreadsheets/d/1ZJRaU0L8VZgGfOaJ5WvLHyfFVeiHaLq9xPI9qTYKY_M/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1"
            title="Open Google Sheet"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-sm">Tracking Sheet</span>
          </a>
        </div>
        <Link
          href="/graphs"
          className="text-blue-500 hover:text-blue-400 transition-colors"
          title="View Graphs"
        >
          <BarChart3 className="w-6 h-6" />
        </Link>
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Showing seizures since {formatPacificDateTime(displayTimestamp).dateStr}{" "}
        at {formatPacificDateTime(displayTimestamp).timeStr}
      </p>
      {seizures.length === 0 ? (
        <p className="text-center text-gray-400">No seizures recorded</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse">
              <thead>
                <tr className="bg-zinc-800">
                  <th className="px-4 py-2 text-left border-b border-zinc-600 min-w-[220px] whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left border-b border-zinc-600">
                    Duration
                  </th>
                  <th className="px-4 py-2 text-left border-b border-zinc-600">
                    Notes
                  </th>
                  <th className="px-4 py-2 text-left border-b border-zinc-600 w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {seizures.map((seizure: Seizure, index: number) => {
                  const { dateStr, timeStr } = formatPacificDateTime(
                    seizure.date,
                  );

                  return (
                    <tr
                      key={seizure.date}
                      className={`border-b border-zinc-700 hover:bg-zinc-800/50 transition-colors ${
                        index % 2 === 0 ? "" : "bg-zinc-700/10"
                      }`}
                    >
                      <td className="px-4 py-3 text-sm min-w-[220px] whitespace-nowrap">
                        {dateStr} {timeStr}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{seizure.duration}s</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {cleanNotes(seizure.notes)}
                      </td>
                      <td className="px-4 py-3">
                        <DeleteButton
                          onClick={() => handleDelete(seizure)}
                          isDeleting={deletingId === seizure.date}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                // Get the last seizure from our current list
                const lastSeizure =
                  olderSeizures.length > 0
                    ? olderSeizures[olderSeizures.length - 1]
                    : todaySeizures[todaySeizures.length - 1];
                if (lastSeizure) {
                  setOldestTimestamp(lastSeizure.date);
                }
              }}
              disabled={isOlderLoading}
              className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {isOlderLoading ? "Loading..." : "Load More Seizures"}
            </button>
          </div>
          {isOlderError && (
            <p className="text-center text-red-500 mt-4">
              {olderError instanceof Error
                ? olderError.message
                : "Failed to load older seizures"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default SeizuresList;
