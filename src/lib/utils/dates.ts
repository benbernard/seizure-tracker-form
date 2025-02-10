import { DateTime } from "luxon";

// For testing - allows us to set a fixed time
export function createDateTime(isoString: string, zone = "UTC") {
  // Parse in UTC first to get the absolute instant in time
  const utcDateTime = DateTime.fromISO(isoString);

  // If the target zone is UTC, return as is
  if (zone === "UTC") {
    return utcDateTime;
  }

  // Otherwise convert to target timezone preserving the instant
  return utcDateTime.setZone(zone);
}

// Convert a local Pacific time Date object to UTC timestamp in seconds
export function pacificToUtcTimestamp(pacificDate: Date): number {
  // Create a DateTime in the local timezone first
  const localDateTime = DateTime.fromJSDate(pacificDate);

  // Assume the time is meant to be Pacific time
  const pacificDateTime = localDateTime.setZone("America/Los_Angeles", {
    keepLocalTime: true,
  });

  // Convert to UTC and get seconds
  return Math.floor(pacificDateTime.toUTC().toSeconds());
}

// Convert a UTC timestamp in seconds to a Pacific time Date object
export function utcToPacificDate(utcTimestamp: number): Date {
  return DateTime.fromSeconds(utcTimestamp)
    .setZone("America/Los_Angeles")
    .toJSDate();
}

// Get current UTC timestamp in seconds
export function getCurrentUtcTimestamp(now?: DateTime): number {
  const dt = now || DateTime.utc();
  return Math.floor(dt.toUTC().toSeconds());
}

// Format a UTC timestamp in seconds to Pacific time string
export function formatPacificDateTime(utcTimestamp: number): {
  dateStr: string;
  timeStr: string;
} {
  // Create a DateTime from UTC timestamp first
  const utcDate = DateTime.fromSeconds(utcTimestamp, { zone: "UTC" });

  // Then convert to Pacific time
  const pacificDate = utcDate.setZone("America/Los_Angeles");

  return {
    dateStr: pacificDate.toFormat("yyyy-MM-dd"),
    timeStr: pacificDate.toFormat("h:mm a"),
  };
}

// Get UTC timestamp for start of current Pacific day
export function getCurrentPacificDayStartTimestamp(now?: DateTime): number {
  return (now || DateTime.now())
    .setZone("America/Los_Angeles")
    .startOf("day")
    .toUTC()
    .toSeconds();
}

// Get UTC timestamp for end of current Pacific day
export function getCurrentPacificDayEndTimestamp(now?: DateTime): number {
  return (now || DateTime.now())
    .setZone("America/Los_Angeles")
    .endOf("day")
    .toUTC()
    .toSeconds();
}
