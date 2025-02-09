"use client";

import { useQuery } from "@tanstack/react-query";
import type { Seizure } from "@/lib/aws/schema";
import { listSeizures } from "../actions";
import { BarChart3 } from "lucide-react";
import Link from "next/link";

function SeizuresList() {
  const {
    data: seizures = [],
    error,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["seizures"],
    queryFn: async () => {
      const result = await listSeizures();
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
        <span>Recent Seizures ({seizures.length})</span>
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
              {seizures.map((seizure: Seizure, index: number) => {
                const date = new Date(seizure.date * 1000);
                const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
                const timeStr = date.toLocaleTimeString();

                return (
                  <tr
                    key={seizure.date}
                    className={`border-b border-zinc-700 hover:bg-zinc-800/50 transition-colors ${
                      index % 2 === 0 ? "" : "bg-zinc-700/10"
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
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
