import axios from "axios";
import {
  LATENODE_SEIZURE_API,
  DEBUG_DELETE,
  SKIP_DELETE_WRITES,
} from "@/lib/aws/confs";
import { parse as parseDate } from "date-fns";

interface SheetRow {
  rowNum: number;
  date: string;
  duration: number;
  note: string;
}

export function cleanNote(note: string | null | undefined): string {
  if (!note) return "";
  return note.trim();
}

export function parseSheetDate(dateStr: string): Date | null {
  try {
    // Try MM/dd/yyyy HH:mm format first
    let parsed = parseDate(dateStr, "MM/dd/yyyy HH:mm", new Date());
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try M/d/yyyy HH:mm:ss format
    parsed = parseDate(dateStr, "M/d/yyyy HH:mm:ss", new Date());
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    // If we get here, neither format worked
    console.error("Failed to parse date:", dateStr);
    return null;
  } catch (error) {
    return null;
  }
}

async function findMatchingRows(
  seizureDate: string,
  duration: number,
  note: string,
): Promise<SheetRow[]> {
  try {
    const response = await axios.get(LATENODE_SEIZURE_API);
    const rows = response.data as [string, string, string][];

    // Skip header row
    const dataRows = rows.slice(1);

    const targetDate = parseSheetDate(seizureDate);
    if (!targetDate) {
      console.log("Failed to parse target date:", seizureDate);
      return [];
    }

    if (DEBUG_DELETE) {
      console.log("DEBUG_DELETE Looking for seizure with:", {
        targetDate: targetDate.toISOString(),
        duration,
        note: cleanNote(note),
      });
    }

    const cleanedTargetNote = cleanNote(note);

    const matches = dataRows
      .map((row, index) => {
        const [dateStr, durationStr, noteStr] = row;
        const parsedDate = parseSheetDate(dateStr);
        if (!parsedDate) {
          return null;
        }

        const duration = Number(durationStr);
        if (Number.isNaN(duration)) {
          console.error("Invalid duration:", {
            rowNum: index + 2,
            durationStr,
          });
          return null;
        }

        return {
          rowNum: index + 2, // +2 because we skipped header and 0-based index
          date: dateStr,
          duration,
          note: noteStr || "",
          parsedDate,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .filter((row) => {
        const cleanedRowNote = cleanNote(row.note);
        const datesMatch = row.parsedDate.getTime() === targetDate.getTime();
        const durationsMatch = row.duration === duration;
        const notesMatch = cleanedRowNote === cleanedTargetNote;

        if (DEBUG_DELETE && (datesMatch || durationsMatch || notesMatch)) {
          console.log("DEBUG_DELETE Found partial match:", {
            rowNum: row.rowNum,
            datesMatch,
            durationsMatch,
            notesMatch,
            rowDate: row.parsedDate.toISOString(),
            rowDuration: row.duration,
            rowNote: cleanedRowNote,
          });
        }

        return datesMatch && durationsMatch && notesMatch;
      })
      .sort((a, b) => b.rowNum - a.rowNum);

    if (DEBUG_DELETE) {
      console.log("DEBUG_DELETE Found matching rows:", matches.length);
      for (const match of matches) {
        console.log("DEBUG_DELETE Match details:", {
          rowNum: match.rowNum,
          date: match.parsedDate.toISOString(),
          duration: match.duration,
          note: cleanNote(match.note),
        });
      }
    }

    return matches;
  } catch (error) {
    console.error("Error finding matching rows:", error);
    throw error;
  }
}

export async function deleteFromLatenode(
  date: Date,
  duration: number,
  note: string,
): Promise<void> {
  const dateStr = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const formattedDate = `${dateStr} ${timeStr}`;

  if (DEBUG_DELETE) {
    console.log("DEBUG_DELETE Starting deletion process for:", {
      formattedDate,
      duration,
      note,
    });
  }

  const matchingRows = await findMatchingRows(formattedDate, duration, note);

  if (matchingRows.length === 0) {
    if (DEBUG_DELETE) {
      console.log("DEBUG_DELETE No matching rows found to delete");
    }
    return;
  }

  // Delete rows one by one, starting from highest row number
  for (const row of matchingRows) {
    if (DEBUG_DELETE) {
      console.log("DEBUG_DELETE Would delete row:", {
        rowNum: row.rowNum,
        date: row.date,
        duration: row.duration,
        note: row.note,
      });
    }

    if (SKIP_DELETE_WRITES) {
      continue; // Skip actual deletion when SKIP_DELETE_WRITES is true
    }

    await axios.delete(LATENODE_SEIZURE_API, {
      data: { rowNum: row.rowNum },
    });
  }
}
