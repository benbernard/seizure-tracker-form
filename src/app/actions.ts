"use server";

import {
  MEDICATION_CHANGES_TABLE,
  PATIENTS_TABLE,
  SETTINGS_TABLE,
  LATENODE_SEIZURE_API,
} from "@/lib/aws/confs";
import { SEIZURES_TABLE, docClient } from "@/lib/aws/dynamodb";
import type {
  MedicationChange,
  Patient,
  Seizure,
  Settings,
} from "@/lib/aws/schema";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import { revalidatePath } from "next/cache";
import { parse } from "papaparse";
import { deleteFromLatenode } from "@/lib/latenode/sheets";
import {
  getCurrentUtcTimestamp,
  pacificToUtcTimestamp,
} from "@/lib/utils/dates";

const SETTINGS_ID = "global";

export async function getSettings() {
  try {
    const command = new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: {
        id: SETTINGS_ID,
      },
    });

    const response = await docClient.send(command);
    const settings = (response.Item as Settings) || {
      id: SETTINGS_ID,
      enableLatenode: false,
      currentPatientId: "kat", // Set default patient
      updatedAt: Date.now() / 1000,
    };

    // If no patient is selected, use the default
    if (!settings.currentPatientId) {
      settings.currentPatientId = "kat";
      // Save the default setting
      const updateCommand = new PutCommand({
        TableName: SETTINGS_TABLE,
        Item: settings,
      });
      await docClient.send(updateCommand);
    }

    return settings;
  } catch (error) {
    console.error("Error fetching settings:", error);
    throw new Error("Failed to fetch settings");
  }
}

export async function updateSettings({
  enableLatenode,
}: { enableLatenode: boolean }) {
  try {
    const settings: Settings = {
      id: SETTINGS_ID,
      enableLatenode,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const command = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: settings,
    });

    await docClient.send(command);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating settings:", error);
    return { error: "Failed to update settings" };
  }
}

export async function listSeizures(startTime?: number) {
  try {
    const command = new QueryCommand({
      TableName: SEIZURES_TABLE,
      KeyConditionExpression: startTime
        ? "#patient = :patient AND #date >= :startTime"
        : "#patient = :patient",
      ExpressionAttributeNames: {
        "#patient": "patient",
        ...(startTime && { "#date": "date" }),
      },
      ExpressionAttributeValues: {
        ":patient": "kat",
        ...(startTime && { ":startTime": startTime }),
      },
      ScanIndexForward: false, // This will return items in descending order (newest first)
    });

    const response = await docClient.send(command);
    return { seizures: (response.Items as Seizure[]) || [] };
  } catch (error) {
    console.error("Error fetching seizures:", error);
    return { error: "Failed to fetch seizures" };
  }
}

export async function submitSeizure(duration: string, notes?: string) {
  try {
    const seizure: Seizure = {
      patient: "kat",
      date: getCurrentUtcTimestamp(),
      duration: Number(duration),
      notes: notes?.trim() || "WebForm",
    };

    const command = new PutCommand({
      TableName: SEIZURES_TABLE,
      Item: seizure,
    });

    await docClient.send(command);

    // Check settings and call webhook if enabled
    const settings = await getSettings();
    if (settings.enableLatenode) {
      await axios.post(
        "https://webhook.latenode.com/11681/prod/84908c3c-1283-4f18-9ef3-d773bd08ad6e",
        {
          duration,
          notes: `WebForm: ${notes?.trim() || ""}`,
        },
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error creating seizure:", error);
    return { error: "Failed to create seizure" };
  }
}

export async function createDefaultPatient() {
  try {
    const command = new PutCommand({
      TableName: PATIENTS_TABLE,
      Item: {
        id: "kat",
        name: "Kat",
        createdAt: Date.now(),
      } as Patient,
    });

    await docClient.send(command);
  } catch (error) {
    console.error("Error creating default patient:", error);
    throw new Error("Failed to create default patient");
  }
}

export async function getPatients() {
  try {
    const command = new ScanCommand({
      TableName: PATIENTS_TABLE,
    });

    const response = await docClient.send(command);
    return response.Items as Patient[];
  } catch (error) {
    console.error("Error getting patients:", error);
    throw new Error("Failed to get patients");
  }
}

export async function updateCurrentPatient(patientId: string) {
  try {
    const command = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: {
        id: "global",
        enableLatenode: false,
        currentPatientId: patientId,
        updatedAt: Date.now(),
      } as Settings,
    });

    await docClient.send(command);
    revalidatePath("/");
  } catch (error) {
    console.error("Error updating current patient:", error);
    throw new Error("Failed to update current patient");
  }
}

export async function deleteAllSeizures() {
  try {
    // First, get all seizures for the current patient
    const command = new ScanCommand({
      TableName: SEIZURES_TABLE,
      FilterExpression: "#patient = :patient",
      ExpressionAttributeNames: {
        "#patient": "patient",
      },
      ExpressionAttributeValues: {
        ":patient": "kat",
      },
    });

    const response = await docClient.send(command);
    const items = response.Items || [];
    console.log(`Starting deletion of ${items.length} seizures...`);

    // Process items in batches of 25 (DynamoDB BatchWrite limit)
    const BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    let deletedCount = 0;
    for (const batch of batches) {
      try {
        const batchCommand = new BatchWriteCommand({
          RequestItems: {
            [SEIZURES_TABLE]: batch.map((item) => ({
              DeleteRequest: {
                Key: {
                  patient: item.patient,
                  date: item.date,
                },
              },
            })),
          },
        });

        const result = await docClient.send(batchCommand);

        // Handle unprocessed items
        if (result.UnprocessedItems?.[SEIZURES_TABLE]?.length) {
          console.error(
            "Error: Some items were not processed:",
            result.UnprocessedItems[SEIZURES_TABLE],
          );
        } else {
          deletedCount += batch.length;
          if (deletedCount % 500 === 0 || deletedCount === items.length) {
            console.log(
              `Deleted ${deletedCount} of ${items.length} seizures...`,
            );
          }
        }
      } catch (error) {
        console.error("Error processing delete batch:", error);
        throw error;
      }
    }

    console.log(`Deletion complete. ${deletedCount} seizures deleted.`);
    revalidatePath("/");
    return { success: true, count: deletedCount };
  } catch (error) {
    console.error("Error deleting seizures:", error);
    return { error: "Failed to delete seizures" };
  }
}

export async function uploadSeizuresFromCSV(csvContent: string) {
  try {
    const { data, errors } = parse<[string, string, string]>(csvContent, {
      skipEmptyLines: true,
      header: false,
      // Keep raw values to handle dates properly
      transform: (value) => value.trim(),
    });

    // Skip header row
    const dataRows = data.slice(1);
    console.log(`Starting processing of ${dataRows.length} rows...`);
    const failedRows: string[] = [];
    let successCount = 0;

    // Log any parsing errors
    if (errors.length > 0) {
      console.error("CSV parsing errors:", errors);
      for (const error of errors) {
        failedRows.push(
          `CSV parsing error on row ${error.row}: ${error.message}`,
        );
      }
    }

    // First, parse all rows and group by minute
    interface ParsedRow {
      originalRow: string[];
      date: Date;
      duration: number;
      notes: string;
    }

    const parsedRows: ParsedRow[] = [];
    for (const row of dataRows) {
      try {
        const [timeStr, durationStr, notes] = row;

        // Parse the date string to Date object, assuming Pacific time
        const date = new Date(timeStr);
        if (Number.isNaN(date.getTime())) {
          console.error(
            `Failed to parse date: "${timeStr}" from row: ${row.join(",")}`,
          );
          failedRows.push(`Invalid date format (${timeStr}): ${row.join(",")}`);
          continue;
        }

        // Handle empty duration
        if (!durationStr?.trim()) {
          console.error(`Empty duration in row: ${row.join(",")}`);
          failedRows.push(`Empty duration: ${row.join(",")}`);
          continue;
        }

        const duration = Number.parseInt(durationStr, 10);
        if (Number.isNaN(duration)) {
          console.error(
            `Failed to parse duration: "${durationStr}" from row: ${row.join(",")}`,
          );
          failedRows.push(
            `Invalid duration (${durationStr}): ${row.join(",")}`,
          );
          continue;
        }

        parsedRows.push({
          originalRow: row,
          date,
          duration,
          notes: notes?.trim() || "CSV Import",
        });
      } catch (error) {
        console.error(`Error processing CSV row: ${row.join(",")}`, error);
        failedRows.push(
          `Failed to process row (${error instanceof Error ? error.message : "Unknown error"}): ${row.join(",")}`,
        );
      }
    }

    // Sort rows by date
    parsedRows.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by minute
    const minuteGroups = new Map<string, ParsedRow[]>();
    for (const row of parsedRows) {
      const minuteKey = row.date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
      if (!minuteGroups.has(minuteKey)) {
        minuteGroups.set(minuteKey, []);
      }
      const group = minuteGroups.get(minuteKey);
      if (group) {
        group.push(row);
      }
    }

    // Process rows in batches of 25 (DynamoDB BatchWrite limit)
    const BATCH_SIZE = 25;
    const batches: Seizure[][] = [];
    const currentBatch: Seizure[] = [];

    // Create seizures with adjusted seconds and convert to UTC
    for (const [, rows] of minuteGroups) {
      rows.forEach((row, index) => {
        const adjustedDate = new Date(row.date);
        adjustedDate.setSeconds(index); // Add sequential seconds

        const seizure: Seizure = {
          patient: "kat",
          date: pacificToUtcTimestamp(adjustedDate),
          duration: row.duration,
          notes: row.notes,
        };

        currentBatch.push(seizure);

        // When we reach BATCH_SIZE, create a new batch
        if (currentBatch.length === BATCH_SIZE) {
          batches.push([...currentBatch]);
          currentBatch.length = 0;
        }
      });
    }

    // Don't forget the last partial batch
    if (currentBatch.length > 0) {
      batches.push([...currentBatch]);
    }

    // Process all batches
    for (const batch of batches) {
      try {
        const command = new BatchWriteCommand({
          RequestItems: {
            [SEIZURES_TABLE]: batch.map((seizure) => ({
              PutRequest: {
                Item: seizure,
              },
            })),
          },
        });

        const result = await docClient.send(command);

        // Handle unprocessed items
        if (result.UnprocessedItems?.[SEIZURES_TABLE]?.length) {
          console.error(
            "Error: Some items were not processed by DynamoDB:",
            JSON.stringify(result.UnprocessedItems[SEIZURES_TABLE], null, 2),
          );
          // Add unprocessed items to failedRows
          for (const item of result.UnprocessedItems[SEIZURES_TABLE]) {
            if (item.PutRequest?.Item) {
              const seizure = item.PutRequest.Item;
              failedRows.push(
                `DynamoDB failed to process: date=${seizure.date}, duration=${seizure.duration}, notes=${seizure.notes}. Reason: ${JSON.stringify(item)}`,
              );
            }
          }
        } else {
          successCount += batch.length;
          if (successCount % 500 === 0 || successCount === dataRows.length) {
            console.log(
              `Processed ${successCount} of ${dataRows.length} rows...`,
            );
          }
        }
      } catch (error) {
        console.error("Error processing batch in DynamoDB:", error);
        if (error instanceof Error) {
          console.error("DynamoDB Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
            // @ts-ignore - DynamoDB errors often have a code property
            code: error.code,
            // @ts-ignore - DynamoDB errors often have a statusCode property
            statusCode: error.statusCode,
            // @ts-ignore - Capture any additional properties
            details: error,
          });
        }
        // Add all items in the failed batch to failedRows with more context
        for (const seizure of batch) {
          const errorDetails =
            error instanceof Error
              ? `${error.name}: ${error.message}${
                  // @ts-ignore - DynamoDB errors often have these properties
                  error.code ? ` (Code: ${error.code})` : ""
                }`
              : "Unknown error";
          failedRows.push(
            `DynamoDB batch error (${errorDetails}): date=${seizure.date}, duration=${seizure.duration}, notes=${seizure.notes}`,
          );
        }
      }
    }

    revalidatePath("/");
    return {
      success: true,
      totalRows: dataRows.length,
      successCount,
      failedRows,
    };
  } catch (error) {
    console.error("Error processing CSV upload:", error);
    return { error: "Failed to process CSV upload" };
  }
}

export async function listMedicationChanges(
  patientId: string,
  fromDate?: number,
) {
  try {
    const command = new QueryCommand({
      TableName: MEDICATION_CHANGES_TABLE,
      KeyConditionExpression: fromDate
        ? "id = :patientId AND #date >= :fromDate"
        : "id = :patientId",
      ...(fromDate && {
        ExpressionAttributeNames: {
          "#date": "date",
        },
      }),
      ExpressionAttributeValues: {
        ":patientId": patientId,
        ...(fromDate && { ":fromDate": fromDate }),
      },
    });

    const response = await docClient.send(command);
    return {
      medicationChanges: (response.Items || []) as MedicationChange[],
    };
  } catch (error) {
    console.error("Error listing medication changes:", error);
    return { error: "Failed to list medication changes" };
  }
}

export async function createMedicationChange(
  medicationChange: MedicationChange,
) {
  try {
    const command = new PutCommand({
      TableName: MEDICATION_CHANGES_TABLE,
      Item: medicationChange,
    });

    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error("Error creating medication change:", error);
    return { error: "Failed to create medication change" };
  }
}

export async function deleteMedicationChange(patientId: string, date: number) {
  try {
    const command = new DeleteCommand({
      TableName: MEDICATION_CHANGES_TABLE,
      Key: {
        id: patientId,
        date: date,
      },
    });

    await docClient.send(command);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting medication change:", error);
    return { error: "Failed to delete medication change" };
  }
}

export async function deleteSeizure(date: number) {
  try {
    // First get the seizure details
    const getCommand = new GetCommand({
      TableName: SEIZURES_TABLE,
      Key: {
        patient: "kat",
        date,
      },
    });

    const response = await docClient.send(getCommand);
    const seizure = response.Item as Seizure;

    if (!seizure) {
      return { error: "Seizure not found" };
    }

    console.log("BENBEN Found seizure to delete:", seizure);

    // Check settings and call webhook if enabled
    const settings = await getSettings();
    if (settings.enableLatenode) {
      await deleteFromLatenode(
        new Date(seizure.date * 1000),
        seizure.duration,
        seizure.notes || "",
      );
    }

    // Commented out deletion for now
    const command = new DeleteCommand({
      TableName: SEIZURES_TABLE,
      Key: {
        patient: "kat",
        date,
      },
    });
    await docClient.send(command);

    console.log("BENBEN Would have deleted seizure from DynamoDB:", {
      patient: "kat",
      date,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting seizure:", error);
    return { error: "Failed to delete seizure" };
  }
}
