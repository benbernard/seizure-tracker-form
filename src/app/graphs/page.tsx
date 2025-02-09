"use client";

import { useQuery } from "@tanstack/react-query";
import { listSeizures } from "../actions";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Seizure } from "@/lib/aws/schema";

function SeizureChart({
  data,
  title,
  dotSize = 4,
}: {
  data: { date: string; count: number }[];
  title: string;
  dotSize?: number;
}) {
  return (
    <div className="mt-8 h-[400px] w-full rounded-lg border border-zinc-600 bg-zinc-900/50 p-4">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="h-[calc(100%-2rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 10,
              bottom: 30,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis
              dataKey="date"
              stroke="#fff"
              angle={-45}
              textAnchor="end"
              height={70}
              tick={{ fill: "#fff" }}
            />
            <YAxis
              stroke="#fff"
              tick={{ fill: "#fff" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#27272a",
                border: "1px solid #52525b",
                borderRadius: "0.375rem",
                color: "#fff",
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: "#22c55e", r: dotSize }}
              name="Seizures"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function processSeizureData(seizures: Seizure[], startDate?: Date) {
  // Get start date (either provided or 6 weeks ago)
  const start =
    startDate ||
    (() => {
      const date = new Date();
      date.setDate(date.getDate() - 42);
      return date;
    })();

  // Create a map of dates to count
  const dailyCounts = new Map<string, number>();

  // Initialize all dates from start to now with 0
  for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
    dailyCounts.set(d.toISOString().split("T")[0], 0);
  }

  // Count seizures per day
  for (const seizure of seizures) {
    const date = new Date(seizure.date * 1000).toISOString().split("T")[0];
    if (dailyCounts.has(date)) {
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    }
  }

  // Convert to array format for recharts
  return Array.from(dailyCounts.entries())
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getDateRangeString(startDate?: Date) {
  const endDate = new Date();
  const start =
    startDate ||
    (() => {
      const date = new Date();
      date.setDate(date.getDate() - 42);
      return date;
    })();

  return `${start.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
}

export default function GraphsPage() {
  // Query for last 6 weeks
  const sixWeeksAgo = Math.floor(Date.now() / 1000) - 42 * 24 * 60 * 60;
  const {
    data: recentSeizures = [],
    isLoading: isLoadingRecent,
    error: recentError,
  } = useQuery({
    queryKey: ["seizures", "recent"],
    queryFn: async () => {
      const result = await listSeizures(sixWeeksAgo);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.seizures || [];
    },
  });

  // Query for all time
  const {
    data: allSeizures = [],
    isLoading: isLoadingAll,
    error: allError,
  } = useQuery({
    queryKey: ["seizures", "all"],
    queryFn: async () => {
      const result = await listSeizures();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.seizures || [];
    },
  });

  if (isLoadingRecent || isLoadingAll) {
    return (
      <div className="min-h-screen bg-zinc-800 text-white">
        <div className="flex justify-center p-4">
          <div className="w-full max-w-[800px]">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (recentError || allError) {
    const error = recentError || allError;
    return (
      <div className="min-h-screen bg-zinc-800 text-white">
        <div className="flex justify-center p-4">
          <div className="w-full max-w-[800px]">
            <h1 className="text-2xl font-bold mb-4">Error loading data</h1>
            <p className="text-red-500">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const recentChartData = processSeizureData(recentSeizures);
  const allTimeChartData = processSeizureData(
    allSeizures,
    new Date(allSeizures[allSeizures.length - 1]?.date * 1000),
  );

  return (
    <div className="min-h-screen bg-zinc-800 text-white">
      <div className="flex justify-center p-4">
        <div className="w-full max-w-[800px]">
          <h1 className="text-2xl font-bold mb-2">Seizure Frequency</h1>
          <p className="text-gray-400 mb-4">
            Tracking seizure occurrences over time
          </p>

          <SeizureChart
            data={recentChartData}
            title={`Last 6 Weeks (${getDateRangeString()})`}
            dotSize={4}
          />

          <SeizureChart
            data={allTimeChartData}
            title={`All Time (${getDateRangeString(
              new Date(allSeizures[allSeizures.length - 1]?.date * 1000),
            )})`}
            dotSize={2}
          />
        </div>
      </div>
    </div>
  );
}
