"use server";

import { docClient, SEIZURES_TABLE } from "@/lib/aws/dynamodb";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Seizure, Settings, Patient } from "@/lib/aws/schema";
import { revalidatePath } from "next/cache";
import { SETTINGS_TABLE, PATIENTS_TABLE } from "@/lib/aws/confs";
import axios from "axios";

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
    return (
      (response.Item as Settings) || {
        id: SETTINGS_ID,
        enableLatenode: false,
        updatedAt: Date.now() / 1000,
      }
    );
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

export async function listSeizures() {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const command = new QueryCommand({
      TableName: SEIZURES_TABLE,
      KeyConditionExpression: "#patient = :patient AND #date >= :oneDayAgo",
      ExpressionAttributeNames: {
        "#patient": "patient",
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":patient": "kat",
        ":oneDayAgo": oneDayAgo,
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
      date: Math.floor(Date.now() / 1000),
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

    // Delete each item
    for (const item of items) {
      const deleteCommand = new DeleteCommand({
        TableName: SEIZURES_TABLE,
        Key: {
          patient: item.patient,
          date: item.date,
        },
      });
      await docClient.send(deleteCommand);
    }

    revalidatePath("/");
    return { success: true, count: items.length };
  } catch (error) {
    console.error("Error deleting seizures:", error);
    return { error: "Failed to delete seizures" };
  }
}

export async function uploadSeizuresFromCSV(csvContent: string) {
  try {
    const lines = csvContent.split("\n");
    // Skip header row
    const dataRows = lines.slice(1).filter((line) => line.trim());
    const failedRows: string[] = [];
    let successCount = 0;

    // Process rows in batches of 25 (DynamoDB BatchWrite limit)
    const BATCH_SIZE = 25;
    const batches: Seizure[][] = [];
    const currentBatch: Seizure[] = [];

    for (const row of dataRows) {
      try {
        const [timeStr, durationStr, notes] = row
          .split(",")
          .map((field) => field.trim());

        // Parse the date string to Unix timestamp
        const date = new Date(timeStr);
        if (Number.isNaN(date.getTime())) {
          failedRows.push(`Invalid date format: ${row}`);
          continue;
        }

        const duration = Number.parseInt(durationStr, 10);
        if (Number.isNaN(duration)) {
          failedRows.push(`Invalid duration: ${row}`);
          continue;
        }

        const seizure: Seizure = {
          patient: "kat", // TODO: Use currentPatientId from settings
          date: Math.floor(date.getTime() / 1000),
          duration,
          notes: notes?.replace(/^"(.*)"$/, "$1") || "CSV Import",
        };

        currentBatch.push(seizure);

        // When we reach BATCH_SIZE, create a new batch
        if (currentBatch.length === BATCH_SIZE) {
          batches.push([...currentBatch]);
          currentBatch.length = 0;
        }
      } catch (error) {
        console.error("Error processing CSV row:", row, error);
        failedRows.push(row);
      }
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
            "Error: Some items were not processed:",
            result.UnprocessedItems[SEIZURES_TABLE],
          );
          // Add unprocessed items to failedRows
          for (const item of result.UnprocessedItems[SEIZURES_TABLE]) {
            if (item.PutRequest?.Item) {
              failedRows.push(JSON.stringify(item.PutRequest.Item));
            }
          }
        } else {
          successCount += batch.length;
        }
      } catch (error) {
        console.error("Error processing batch:", error);
        // Add all items in the failed batch to failedRows
        for (const seizure of batch) {
          failedRows.push(JSON.stringify(seizure));
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
