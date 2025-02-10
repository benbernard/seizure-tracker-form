import { DateTime } from "luxon";

// Convert a local Pacific time Date object to UTC timestamp in seconds
export function pacificToUtcTimestamp(pacificDate: Date): number {
  return Math.floor(
    DateTime.fromJSDate(pacificDate)
      .setZone("America/Los_Angeles")
      .toUTC()
      .toSeconds(),
  );
}

// Convert a UTC timestamp in seconds to a Pacific time Date object
export function utcToPacificDate(utcTimestamp: number): Date {
  return DateTime.fromSeconds(utcTimestamp)
    .setZone("America/Los_Angeles")
    .toJSDate();
}

// Get current UTC timestamp in seconds
export function getCurrentUtcTimestamp(): number {
  return Math.floor(DateTime.utc().toSeconds());
}

// Format a UTC timestamp in seconds to Pacific time string
export function formatPacificDateTime(utcTimestamp: number): {
  dateStr: string;
  timeStr: string;
} {
  const pacificDate = DateTime.fromSeconds(utcTimestamp).setZone(
    "America/Los_Angeles",
  );

  return {
    dateStr: pacificDate.toFormat("yyyy-MM-dd"),
    timeStr: pacificDate.toFormat("h:mm:ss a"),
  };
}
