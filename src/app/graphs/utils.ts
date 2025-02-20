import { DateTime } from "luxon";
import type { Seizure } from "@/lib/aws/schema";
import { formatPacificDateTime } from "@/lib/utils/dates";

export interface SeizureDataPoint {
  date: string;
  count: number;
}

export function processSeizureData(
  seizures: Seizure[],
  startDate?: Date,
): SeizureDataPoint[] {
  // Get start date (either provided or 6 weeks ago) in Pacific time
  const start = startDate
    ? DateTime.fromJSDate(startDate).setZone("America/Los_Angeles")
    : DateTime.now().setZone("America/Los_Angeles").minus({ weeks: 6 });

  // Create a map of dates to count
  const dailyCounts = new Map<string, number>();

  // Get current date in Pacific time
  const currentPacificDate = DateTime.now().setZone("America/Los_Angeles");

  // Initialize all dates from start to current Pacific date with 0
  for (let d = start; d <= currentPacificDate; d = d.plus({ days: 1 })) {
    dailyCounts.set(d.toFormat("yyyy-MM-dd"), 0);
  }

  // Count seizures per day
  for (const seizure of seizures) {
    const { dateStr } = formatPacificDateTime(seizure.date);
    if (dailyCounts.has(dateStr)) {
      dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
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
