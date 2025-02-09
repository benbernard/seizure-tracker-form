"use client";

import type { Seizure } from "@/lib/aws/schema";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, FileSpreadsheet, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { deleteSeizure, listSeizures } from "../actions";

function SeizuresList() {
  const queryClient = useQueryClient();
  const {
    data: seizures = [],
    error,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["seizures"],
    queryFn: async () => {
      // Get timestamp for 24 hours ago
      const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
      const result = await listSeizures(oneDayAgo);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.seizures || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    retry: 3,
  });

  if (isLoading) {
    return <p className="text-center mt-4">Loading seizures...</p>;
  }

  if (isError) {
    return (
      <div className="text-center mt-4">
        <p className="text-red-500 mb-2">
          {error instanceof Error ? error.message : "Failed to load seizures"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
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
      {seizures.length === 0 ? (
        <p className="text-center text-gray-400">
          No seizures recorded in the last 24 hours
        </p>
      ) : (
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
                const date = new Date(seizure.date * 1000);
                const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
                const timeStr = date.toLocaleTimeString();

                const handleDelete = async () => {
                  if (
                    !window.confirm(
                      "Warning: This will only delete the record in DynamoDB. You will need to manually update the Google Sheet. Do you want to proceed?",
                    )
                  ) {
                    return;
                  }

                  const result = await deleteSeizure(seizure.date);
                  if (result.success) {
                    toast.success("Seizure record deleted");
                    queryClient.invalidateQueries({ queryKey: ["seizures"] });
                  } else {
                    toast.error(result.error || "Failed to delete seizure");
                  }
                };

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
                      {(seizure.notes?.endsWith(":")
                        ? seizure.notes.slice(0, -1)
                        : seizure.notes) || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={handleDelete}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-400/10"
                        title="Delete seizure record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SeizuresList;
