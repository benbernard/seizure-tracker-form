"use client";

import type { MedicationChange, Seizure } from "@/lib/aws/schema";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
} from "recharts";
import {
  createMedicationChange,
  deleteMedicationChange,
  getSettings,
  listMedicationChanges,
  listSeizures,
} from "../actions";
import { usePatientId } from "../components/PatientContext";
import html2canvas from "html2canvas";
import {
  formatPacificDateTime,
  getCurrentPacificDayStartTimestamp,
} from "@/lib/utils/dates";
import { DateTime } from "luxon";
import { processSeizureData, type SeizureDataPoint } from "./utils";

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-zinc-800">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500" />
    </div>
  );
}

function FullScreenChart({
  isOpen,
  onClose,
  children,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  // Add event listener for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 rounded-lg p-6 w-[95vw] h-[90vh]">
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
        <div className="h-[calc(100%-3rem)]">{children}</div>
      </div>
    </div>
  );
}

function SeizureChart({
  data,
  title,
  dotSize = 4,
  medicationChanges = [],
  verticalLabels = false,
}: {
  data: { date: string; count: number }[];
  title: string;
  dotSize?: number;
  medicationChanges?: MedicationChange[];
  verticalLabels?: boolean;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [zoomedDomain, setZoomedDomain] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Sort medication changes by date
  const sortedChanges = [...medicationChanges].sort((a, b) => a.date - b.date);

  // Prepare data with medication changes
  const enrichedData = data.map((point) => {
    const changesOnDate = sortedChanges.filter(
      (change) =>
        new Date(change.date * 1000).toISOString().split("T")[0] === point.date,
    );
    return {
      ...point,
      medicationChanges: changesOnDate.length > 0 ? changesOnDate : undefined,
    };
  });

  const handleMouseDown = (e: { activeLabel?: string }) => {
    if (!e?.activeLabel) return;
    // Prevent text selection
    document.body.style.userSelect = "none";
    setRefAreaLeft(e.activeLabel);
  };

  const handleMouseMove = (e: {
    activeLabel?: string;
    preventDefault?: () => void;
  }) => {
    if (!e?.activeLabel) return;
    if (refAreaLeft) {
      e.preventDefault?.();
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    // Re-enable text selection
    document.body.style.userSelect = "";

    if (!refAreaLeft || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // Ensure left is before right
    const [start, end] = [refAreaLeft, refAreaRight].sort();
    setZoomedDomain({ start, end });

    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const resetZoom = () => {
    setZoomedDomain(null);
  };

  const displayData = zoomedDomain
    ? enrichedData.filter(
        (d) => d.date >= zoomedDomain.start && d.date <= zoomedDomain.end,
      )
    : enrichedData;

  const handleDownload = async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#27272a", // Match the dark theme
        scale: 2, // Higher quality
      });

      const link = document.createElement("a");
      link.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Chart downloaded successfully!");
    } catch (error) {
      console.error("Error downloading chart:", error);
      toast.error("Failed to download chart");
    }
  };

  const chartContent = (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={displayData}
        margin={{
          top: 80,
          right: 80,
          left: 10,
          bottom: 30,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredDate(null);
          if (refAreaLeft) {
            setRefAreaLeft(null);
            setRefAreaRight(null);
          }
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
          allowDataOverflow
        />
        <YAxis stroke="#fff" tick={{ fill: "#fff" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #52525b",
            borderRadius: "0.375rem",
            color: "#fff",
            padding: "8px",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;

            const data = payload[0].payload;
            return (
              <div className="bg-zinc-800 p-3 rounded-lg shadow-lg min-w-[200px]">
                <p className="font-semibold">{data.date}</p>
                <p>Seizures: {data.count}</p>
                {data.medicationChanges?.map((change: MedicationChange) => (
                  <div
                    key={`${change.date}-${change.medication}`}
                    className="mt-2 border-t border-zinc-600 pt-2"
                  >
                    <p className="text-amber-400">{change.medication}</p>
                    <p className="text-sm">
                      {change.type} - {change.dosage}
                    </p>
                    {change.notes && change.notes !== "Bulk import" && (
                      <p className="text-sm text-gray-400">{change.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          }}
        />
        {sortedChanges.map((change) => {
          const changeDate = new Date(change.date * 1000)
            .toISOString()
            .split("T")[0];
          const isHighlighted = hoveredDate === changeDate;
          return (
            <g key={`${change.date}-${change.medication}`}>
              <ReferenceLine
                key={`${change.date}-${change.medication}-line`}
                x={changeDate}
                stroke={isHighlighted ? "#fbbf24" : "#f59e0b"}
                strokeDasharray="3 3"
                strokeWidth={isHighlighted ? 2 : 1}
                label={{
                  value: `${change.medication} - ${change.dosage}`,
                  position: "top",
                  fill: isHighlighted ? "#fbbf24" : "#f59e0b",
                  fontSize: isHighlighted ? 13 : 12,
                  offset: 20,
                  textAnchor: "start",
                  angle: -45,
                  dy: -20,
                  dx: 30,
                  ...(isHighlighted && {
                    backgroundColor: "#27272a",
                    backgroundOpacity: 0.95,
                    padding: 6,
                    radius: 4,
                  }),
                }}
              />
            </g>
          );
        })}
        <Line
          type="monotone"
          dataKey="count"
          stroke="#22c55e"
          strokeWidth={2}
          dot={dotSize ? { fill: "#22c55e", r: dotSize } : false}
          name="Seizures"
        />
        {refAreaLeft && refAreaRight && (
          <ReferenceArea
            x1={refAreaLeft}
            x2={refAreaRight}
            fill="#22c55e"
            fillOpacity={0.1}
            stroke="#22c55e"
            strokeOpacity={0.3}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <>
      <div className="mt-8 h-[450px] w-full rounded-lg border border-zinc-600 bg-zinc-900/50 p-4 select-none">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex gap-2">
            {zoomedDomain && (
              <button
                onClick={resetZoom}
                className="text-gray-400 hover:text-gray-300 transition-colors"
                title="Reset zoom"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={handleDownload}
              className="text-gray-400 hover:text-gray-300 transition-colors"
              title="Download chart"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
            <button
              ref={expandButtonRef}
              onClick={() => {
                setIsFullScreen(true);
                expandButtonRef.current?.blur();
              }}
              className="text-gray-400 hover:text-gray-300 transition-colors"
              title="View full screen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                />
              </svg>
            </button>
          </div>
        </div>
        <div ref={chartRef} className="h-[calc(100%-2rem)]">
          {chartContent}
        </div>
      </div>

      <FullScreenChart
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        title={title}
      >
        {chartContent}
      </FullScreenChart>
    </>
  );
}

function getDateRangeString(startDate?: Date) {
  const endDate = DateTime.now().setZone("America/Los_Angeles");
  const start = startDate
    ? DateTime.fromJSDate(startDate).setZone("America/Los_Angeles")
    : endDate.minus({ weeks: 6 });

  return `${start.toFormat("M/d/yyyy")} - ${endDate.toFormat("M/d/yyyy")}`;
}

function MedicationChangeModal({
  isOpen,
  onClose,
  patientId,
}: {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
}) {
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [type, setType] = useState<"start" | "stop" | "adjust">("start");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const medicationChange = {
      id: patientId,
      date: DateTime.fromISO(date, { zone: "UTC" }).toSeconds(),
      medication,
      dosage,
      type,
      notes,
    };

    const result = await createMedicationChange(medicationChange);

    if (result.success) {
      toast.success("Medication change added successfully!");
      queryClient.invalidateQueries({ queryKey: ["medicationChanges"] });
      onClose();
      // Reset form
      setMedication("");
      setDosage("");
      setType("start");
      setNotes("");
      setDate(new Date().toISOString().split("T")[0]);
    } else {
      toast.error(result.error || "Failed to add medication change");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add Medication Change</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium mb-1">
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full rounded-md border-gray-300 bg-zinc-700 p-2 text-white [color-scheme:dark]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="medication"
              className="block text-sm font-medium mb-1"
            >
              Medication Name
            </label>
            <input
              type="text"
              id="medication"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              className="w-full rounded-md border-gray-300 bg-zinc-700 p-2 text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="dosage" className="block text-sm font-medium mb-1">
              Dosage
            </label>
            <input
              type="text"
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              className="w-full rounded-md border-gray-300 bg-zinc-700 p-2 text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium mb-1">
              Change Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as "start" | "stop" | "adjust")
              }
              className="w-full rounded-md border-gray-300 bg-zinc-700 p-2 text-white"
            >
              <option value="start">Start</option>
              <option value="stop">Stop</option>
              <option value="adjust">Adjust</option>
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border-gray-300 bg-zinc-700 p-2 text-white"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white bg-zinc-600 rounded hover:bg-zinc-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-amber-600 rounded hover:bg-amber-700"
            >
              Add Change
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(timestamp: number) {
  // Create DateTime from UTC timestamp and format directly in UTC to preserve the date
  return DateTime.fromSeconds(timestamp, { zone: "UTC" }).toFormat(
    "yyyy-MM-dd",
  );
}

function MedicationChangesList({
  changes,
  patientId,
}: { changes: MedicationChange[]; patientId: string }) {
  const sortedChanges = [...changes].sort((a, b) => b.date - a.date);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDelete = async (change: MedicationChange) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the ${change.type} change for ${change.medication}?`,
      )
    ) {
      return;
    }

    const result = await deleteMedicationChange(change.id, change.date);
    if (result.success) {
      toast.success("Medication change deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["medicationChanges"] });
    } else {
      toast.error(result.error || "Failed to delete medication change");
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-zinc-600 bg-zinc-900/50 p-4">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-lg font-semibold">Medication Changes</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors flex items-center gap-2"
        >
          <span>Add Medication Change</span>
        </button>
      </div>
      {sortedChanges.length === 0 ? (
        <p className="text-gray-400">No medication changes recorded.</p>
      ) : (
        <div className="space-y-4">
          {sortedChanges.map((change) => (
            <div
              key={`${change.date}-${change.medication}`}
              className="border-l-4 border-amber-600 pl-4 py-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{change.medication}</h3>
                  <p className="text-sm text-gray-400">
                    {change.type.charAt(0).toUpperCase() + change.type.slice(1)}{" "}
                    - {change.dosage}
                  </p>
                  {change.notes && change.notes !== "Bulk import" && (
                    <p className="text-sm text-gray-400 mt-1">{change.notes}</p>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-sm text-gray-400">
                    {formatDate(change.date)}
                  </span>
                  <button
                    onClick={() => handleDelete(change)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Delete medication change"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MedicationChangeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientId={patientId}
      />
    </div>
  );
}

function GraphsContent() {
  const patientId = usePatientId();
  const sixWeeksAgo = Math.floor(Date.now() / 1000) - 42 * 24 * 60 * 60;
  const [showAllTime, setShowAllTime] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: recentSeizures = [],
    isLoading: isLoadingRecent,
    error: recentError,
  } = useQuery({
    queryKey: ["seizures", "recent", patientId],
    queryFn: async () => {
      const result = await listSeizures(sixWeeksAgo);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.seizures || [];
    },
    enabled: !!patientId,
  });

  const {
    data: allSeizures = [],
    isLoading: isLoadingAll,
    error: allError,
  } = useQuery({
    queryKey: ["seizures", "all", patientId],
    queryFn: async () => {
      const result = await listSeizures(0, Math.floor(Date.now() / 1000));
      if (result.error) {
        throw new Error(result.error);
      }
      return result.seizures || [];
    },
    enabled: !!patientId && showAllTime,
  });

  const { data: medicationChanges = [], isLoading: isLoadingMedChanges } =
    useQuery({
      queryKey: ["medicationChanges", "all", patientId],
      queryFn: async () => {
        if (!patientId) return [];
        const result = await listMedicationChanges(patientId);
        if (result.error) {
          throw new Error(result.error);
        }
        return result.medicationChanges || [];
      },
      enabled: !!patientId,
    });

  const isLoadingRecently = isLoadingRecent || isLoadingMedChanges;
  const isLoadingAllTime = isLoadingAll;
  const error = recentError || (showAllTime && allError);

  // Add loading state for initial patient load
  const { isLoading: isLoadingSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const result = await getSettings();
      return result;
    },
  });

  if (isLoadingSettings) {
    return <LoadingSpinner />;
  }

  if (!patientId) {
    return (
      <div className="min-h-screen bg-zinc-800 text-white">
        <div className="flex justify-center p-4">
          <div className="w-full max-w-[800px]">
            <h1 className="text-2xl font-bold mb-4">No Patient Selected</h1>
            <p className="text-gray-400 mb-4">
              Please select a patient in the settings page to view their seizure
              data.
            </p>
            <Link
              href="/settings"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingRecently) {
    return <LoadingSpinner />;
  }

  if (error) {
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
  const allTimeChartData = showAllTime
    ? processSeizureData(
        allSeizures,
        new Date(allSeizures[allSeizures.length - 1]?.date * 1000),
      )
    : [];

  return (
    <div className="min-h-screen bg-zinc-800 text-white">
      <div className="flex justify-center p-4">
        <div className="w-full max-w-[800px]">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
              title="Back"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold">Seizure Frequency</h1>
          </div>
          <div className="flex justify-between items-center mb-8">
            <p className="text-gray-400 text-lg">
              Tracking seizure occurrences over time with medication changes
            </p>
          </div>

          <SeizureChart
            data={recentChartData}
            title={`Last 6 Weeks (${getDateRangeString()})`}
            dotSize={0}
            medicationChanges={medicationChanges}
          />

          {!showAllTime ? (
            <button
              onClick={() => setShowAllTime(true)}
              className="mt-8 px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
            >
              Load All-Time Data
            </button>
          ) : isLoadingAllTime ? (
            <div className="mt-8 text-center">
              <div className="text-lg text-gray-400">
                Loading all-time data...
              </div>
            </div>
          ) : (
            <SeizureChart
              data={allTimeChartData}
              title={`All Time (${getDateRangeString(
                new Date(allSeizures[allSeizures.length - 1]?.date * 1000),
              )})`}
              dotSize={0}
              medicationChanges={medicationChanges}
              verticalLabels={true}
            />
          )}

          <MedicationChangesList
            changes={medicationChanges}
            patientId={patientId}
          />
        </div>
      </div>
    </div>
  );
}

export default function GraphsPage() {
  return <GraphsContent />;
}
