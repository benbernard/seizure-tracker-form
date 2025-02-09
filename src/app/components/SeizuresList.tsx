"use client";

import { useQuery } from "@tanstack/react-query";
import type { Seizure } from "@/lib/aws/schema";
import { listSeizures } from "../actions";

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
      <h2 className="text-xl font-semibold mb-4">
        Recent Seizures ({seizures.length})
      </h2>
      {seizures.length === 0 ? (
        <p className="text-center text-gray-400">
          No seizures recorded in the last 24 hours
        </p>
      ) : (
        <div className="space-y-4">
          {seizures.map((seizure: Seizure) => (
            <div
              key={seizure.date}
              className="border border-zinc-600 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{seizure.duration}s duration</p>
                  <p className="text-sm text-gray-400">
                    {new Date(seizure.date * 1000).toLocaleString()}
                  </p>
                </div>
                {seizure.notes && (
                  <p className="text-sm text-gray-300">{seizure.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SeizuresList;
