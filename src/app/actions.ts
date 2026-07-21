"use server";

import {
  assertOwnsPatient,
  getCurrentUser,
  getCurrentUserId,
  getPatientById,
  isSuperUser,
  patientIsOwnedBy,
} from "@/lib/auth";
import {
  MEDICATION_CHANGES_TABLE,
  PATIENTS_TABLE,
  SEIZURES_TABLE,
  SETTINGS_TABLE,
} from "@/lib/aws/confs";
import { docClient } from "@/lib/aws/dynamodb";
import type {
  MedicationChange,
  Patient,
  Seizure,
  Settings,
} from "@/lib/aws/schema";
import { isLocalAuth } from "@/lib/clerk";
import {
  getCurrentPacificDayStartTimestamp,
  getCurrentUtcTimestamp,
  pacificToUtcTimestamp,
} from "@/lib/utils/dates";
import { generateUniquePatientId, slugify } from "@/lib/utils/slug";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { parse } from "papaparse";

// ---------------------------------------------------------------------------
// User lookup helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getUserDetails(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (isLocalAuth()) {
    return uniqueIds.map((id) => ({ id, email: `${id}@local` }));
  }
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({
      userId: uniqueIds,
    });
    return data.map((user) => ({
      id: user.id,
      email:
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        user.id,
    }));
  } catch (error) {
    console.error("Error fetching user details from Clerk:", error);
    return uniqueIds.map((id) => ({ id, email: id }));
  }
}

async function findUserByEmail(email: string) {
  if (isLocalAuth()) {
    return { id: email, email };
  }
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({
      emailAddress: [email],
    });
    if (data.length === 0) {
      return null;
    }
    if (data.length > 1) {
      return null;
    }
    const user = data[0];
    return {
      id: user.id,
      email:
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        email,
    };
  } catch (error) {
    console.error("Error looking up user by email:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public actions (no auth required)
// ---------------------------------------------------------------------------

export async function getPublicPatient(patientId: string) {
  const patient = await getPatientById(patientId);
  if (!patient) {
    return null;
  }
  return {
    id: patient.id,
    name: patient.name,
    quickButtonSeconds: patient.quickButtonSeconds ?? [5, 10, 15, 20],
  };
}

export async function getTodaySeizuresPublic(patientId: string) {
  const patient = await getPatientById(patientId);
  if (!patient) {
    return { error: "Patient not found" };
  }

  const startOfDay = getCurrentPacificDayStartTimestamp();
  const command = new QueryCommand({
    TableName: SEIZURES_TABLE,
    KeyConditionExpression: "patient = :patient AND #date >= :start",
    ExpressionAttributeNames: {
      "#date": "date",
    },
    ExpressionAttributeValues: {
      ":patient": patientId,
      ":start": startOfDay,
    },
    ScanIndexForward: false,
  });

  const response = await docClient.send(command);
  return { seizures: (response.Items as Seizure[]) || [] };
}

export async function submitSeizurePublic(
  patientId: string,
  duration: string,
  notes?: string,
) {
  const patient = await getPatientById(patientId);
  if (!patient) {
    return { error: "Patient not found" };
  }

  const durationNum = Number(duration);
  if (!duration || Number.isNaN(durationNum) || durationNum <= 0) {
    return { error: "Duration must be a positive number" };
  }

  const seizure: Seizure = {
    patient: patientId,
    date: getCurrentUtcTimestamp(),
    duration: durationNum,
    notes: notes?.trim() || "WebForm",
  };

  const command = new PutCommand({
    TableName: SEIZURES_TABLE,
    Item: seizure,
  });

  await docClient.send(command);
  revalidatePath(`/p/${patientId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Auth-only actions
// ---------------------------------------------------------------------------

async function getUserSettingsRecord(userId: string): Promise<Settings> {
  const command = new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { id: userId },
  });
  const response = await docClient.send(command);
  return (
    (response.Item as Settings) || {
      id: userId,
      currentPatientId: undefined,
      updatedAt: Math.floor(Date.now() / 1000),
    }
  );
}

export async function getSettings() {
  try {
    const userId = await getCurrentUserId();
    return getUserSettingsRecord(userId);
  } catch (error) {
    console.error("Error fetching settings:", error);
    throw new Error("Failed to fetch settings");
  }
}

export async function updateSettings({
  currentPatientId,
}: { currentPatientId: string | undefined }) {
  try {
    const userId = await getCurrentUserId();

    if (currentPatientId) {
      await assertOwnsPatient(currentPatientId);
    }

    const settings: Settings = {
      id: userId,
      currentPatientId,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const command = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: settings,
    });

    await docClient.send(command);
    revalidatePath("/settings");
    revalidatePath("/graphs");
    return { success: true };
  } catch (error) {
    console.error("Error updating settings:", error);
    return { error: "Failed to update settings" };
  }
}

export async function updateCurrentPatient(patientId: string) {
  try {
    await assertOwnsPatient(patientId);
    const userId = await getCurrentUserId();

    const settings: Settings = {
      id: userId,
      currentPatientId: patientId,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const command = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: settings,
    });

    await docClient.send(command);
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/graphs");
  } catch (error) {
    console.error("Error updating current patient:", error);
    throw new Error("Failed to update current patient");
  }
}

export async function createPatient(name: string) {
  try {
    const userId = await getCurrentUserId();
    const trimmedName = name.trim();

    const existing = await docClient.send(
      new ScanCommand({
        TableName: PATIENTS_TABLE,
        ProjectionExpression: "id",
      }),
    );
    const existingIds = new Set(
      (existing.Items ?? []).map((item) => String(item.id)),
    );

    const patient: Patient = {
      id: generateUniquePatientId(trimmedName, existingIds),
      name: trimmedName,
      ownerId: userId,
      allowedUserIds: [userId],
      createdAt: Date.now(),
    };

    const command = new PutCommand({
      TableName: PATIENTS_TABLE,
      Item: patient,
      ConditionExpression: "attribute_not_exists(id)",
    });

    await docClient.send(command);
    return { success: true, patient };
  } catch (error) {
    console.error("Error creating patient:", error);
    return { error: "Failed to create patient" };
  }
}

export async function addPatientOwner(patientId: string, ownerEmail: string) {
  try {
    await assertOwnsPatient(patientId);
    const userId = await getCurrentUserId();
    const trimmed = ownerEmail.trim().toLowerCase();
    if (!trimmed || !isValidEmail(trimmed)) {
      return { error: "A valid email address is required" };
    }

    const owner = await findUserByEmail(trimmed);
    if (!owner) {
      return { error: "No user found with that email address" };
    }
    const newOwnerId = owner.id;

    if (newOwnerId === userId) {
      return { error: "You already own this patient" };
    }

    const patient = await getPatientById(patientId);
    if (!patient) {
      return { error: "Patient not found" };
    }

    const allowed = new Set(patient.allowedUserIds ?? []);
    if (allowed.has(newOwnerId)) {
      return { error: "User already has access to this patient" };
    }
    allowed.add(newOwnerId);

    const command = new UpdateCommand({
      TableName: PATIENTS_TABLE,
      Key: { id: patientId },
      UpdateExpression: "SET allowedUserIds = :allowedUserIds",
      ExpressionAttributeValues: {
        ":allowedUserIds": Array.from(allowed),
      },
    });

    await docClient.send(command);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error adding patient owner:", error);
    return { error: "Failed to add patient owner" };
  }
}

export async function removePatientOwner(patientId: string, ownerId: string) {
  try {
    await assertOwnsPatient(patientId);
    const trimmed = ownerId.trim();
    if (!trimmed) {
      return { error: "User ID is required" };
    }

    const patient = await getPatientById(patientId);
    if (!patient) {
      return { error: "Patient not found" };
    }

    const allowed = new Set(patient.allowedUserIds ?? []);
    if (!allowed.has(trimmed)) {
      return { error: "User does not have access to this patient" };
    }
    allowed.delete(trimmed);

    const command = new UpdateCommand({
      TableName: PATIENTS_TABLE,
      Key: { id: patientId },
      UpdateExpression: "SET allowedUserIds = :allowedUserIds",
      ExpressionAttributeValues: {
        ":allowedUserIds": Array.from(allowed),
      },
    });

    await docClient.send(command);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error removing patient owner:", error);
    return { error: "Failed to remove patient owner" };
  }
}

export async function getPatientOwnerEmails(patientId: string) {
  try {
    await assertOwnsPatient(patientId);
    const currentUserId = await getCurrentUserId();
    const patient = await getPatientById(patientId);
    if (!patient) {
      return { error: "Patient not found" };
    }

    const userIds = [
      ...new Set([patient.ownerId, ...(patient.allowedUserIds ?? [])]),
    ];
    const users = await getUserDetails(userIds);

    return {
      owners: users.map((user) => ({
        userId: user.id,
        email: user.email,
        isCurrentUser: user.id === currentUserId,
        isOwner: user.id === patient.ownerId,
      })),
    };
  } catch (error) {
    console.error("Error fetching patient owner emails:", error);
    return { error: "Failed to fetch patient owners" };
  }
}

export async function updatePatientQuickButtons(
  patientId: string,
  seconds: number[],
) {
  try {
    await assertOwnsPatient(patientId);
    const patient = await getPatientById(patientId);
    if (!patient) {
      return { error: "Patient not found" };
    }

    const validSeconds = seconds
      .map((s) => Number(s))
      .filter((s) => Number.isInteger(s) && s > 0);
    if (validSeconds.length === 0) {
      return { error: "At least one positive duration is required" };
    }
    if (validSeconds.length > 6) {
      return { error: "At most 6 quick buttons are allowed" };
    }

    const command = new UpdateCommand({
      TableName: PATIENTS_TABLE,
      Key: { id: patientId },
      UpdateExpression: "SET quickButtonSeconds = :seconds",
      ExpressionAttributeValues: {
        ":seconds": validSeconds,
      },
    });

    await docClient.send(command);
    revalidatePath("/settings");
    revalidatePath(`/p/${patientId}`);
    return { success: true, quickButtonSeconds: validSeconds };
  } catch (error) {
    console.error("Error updating quick buttons:", error);
    return { error: "Failed to update quick buttons" };
  }
}

export async function getPatients() {
  try {
    const { userId, email } = await getCurrentUser();
    if (isSuperUser(email)) {
      const command = new ScanCommand({
        TableName: PATIENTS_TABLE,
      });
      const response = await docClient.send(command);
      return (response.Items as Patient[]) || [];
    }

    const command = new ScanCommand({
      TableName: PATIENTS_TABLE,
    });

    const response = await docClient.send(command);
    const items = (response.Items as Patient[]) || [];
    return items.filter((patient) => patientIsOwnedBy(patient, userId));
  } catch (error) {
    console.error("Error getting patients:", error);
    throw new Error("Failed to get patients");
  }
}

export async function listSeizures(
  patientId: string,
  startTimestamp?: number,
  endTimestamp?: number,
) {
  try {
    await assertOwnsPatient(patientId);

    const start = startTimestamp ?? 0;
    const hasEnd = endTimestamp !== undefined;

    const command = new QueryCommand({
      TableName: SEIZURES_TABLE,
      KeyConditionExpression: hasEnd
        ? "patient = :patient AND #date BETWEEN :start AND :end"
        : "patient = :patient AND #date >= :start",
      ExpressionAttributeNames: {
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":patient": patientId,
        ":start": start,
        ...(hasEnd ? { ":end": endTimestamp } : {}),
      },
      ScanIndexForward: false,
    });

    const response = await docClient.send(command);
    return { seizures: (response.Items as Seizure[]) || [] };
  } catch (error) {
    console.error("Error listing seizures:", error);
    return { error: "Failed to list seizures" };
  }
}

export async function submitSeizure(
  patientId: string,
  duration: string,
  notes?: string,
) {
  try {
    await assertOwnsPatient(patientId);

    const durationNum = Number(duration);
    if (!duration || Number.isNaN(durationNum) || durationNum <= 0) {
      return { error: "Duration must be a positive number" };
    }

    const seizure: Seizure = {
      patient: patientId,
      date: getCurrentUtcTimestamp(),
      duration: durationNum,
      notes: notes?.trim() || "WebForm",
    };

    const command = new PutCommand({
      TableName: SEIZURES_TABLE,
      Item: seizure,
    });

    await docClient.send(command);
    revalidatePath("/");
    revalidatePath("/graphs");
    return { success: true };
  } catch (error) {
    console.error("Error creating seizure:", error);
    return { error: "Failed to create seizure" };
  }
}

export async function deleteAllSeizures(patientId: string) {
  try {
    await assertOwnsPatient(patientId);

    const command = new ScanCommand({
      TableName: SEIZURES_TABLE,
      FilterExpression: "#patient = :patient",
      ExpressionAttributeNames: {
        "#patient": "patient",
      },
      ExpressionAttributeValues: {
        ":patient": patientId,
      },
    });

    const response = await docClient.send(command);
    const items = response.Items || [];
    console.log(`Starting deletion of ${items.length} seizures...`);

    const BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    let deletedCount = 0;
    for (const batch of batches) {
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

      if (result.UnprocessedItems?.[SEIZURES_TABLE]?.length) {
        console.error(
          "Error: Some items were not processed:",
          result.UnprocessedItems[SEIZURES_TABLE],
        );
      } else {
        deletedCount += batch.length;
        if (deletedCount % 500 === 0 || deletedCount === items.length) {
          console.log(`Deleted ${deletedCount} of ${items.length} seizures...`);
        }
      }
    }

    console.log(`Deletion complete. ${deletedCount} seizures deleted.`);
    revalidatePath("/");
    revalidatePath("/graphs");
    return { success: true, count: deletedCount };
  } catch (error) {
    console.error("Error deleting seizures:", error);
    return { error: "Failed to delete seizures" };
  }
}

export async function uploadSeizuresFromCSV(
  patientId: string,
  csvContent: string,
) {
  try {
    await assertOwnsPatient(patientId);

    const { data, errors } = parse<[string, string, string]>(csvContent, {
      skipEmptyLines: true,
      header: false,
      transform: (value) => value.trim(),
    });

    const dataRows = data.slice(1);
    console.log(`Starting processing of ${dataRows.length} rows...`);
    const failedRows: string[] = [];
    let successCount = 0;

    if (errors.length > 0) {
      console.error("CSV parsing errors:", errors);
      for (const error of errors) {
        failedRows.push(
          `CSV parsing error on row ${error.row}: ${error.message}`,
        );
      }
    }

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

        const date = new Date(timeStr);
        if (Number.isNaN(date.getTime())) {
          console.error(
            `Failed to parse date: "${timeStr}" from row: ${row.join(",")}`,
          );
          failedRows.push(`Invalid date format (${timeStr}): ${row.join(",")}`);
          continue;
        }

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

    parsedRows.sort((a, b) => a.date.getTime() - b.date.getTime());

    const minuteGroups = new Map<string, ParsedRow[]>();
    for (const row of parsedRows) {
      const minuteKey = row.date.toISOString().slice(0, 16);
      if (!minuteGroups.has(minuteKey)) {
        minuteGroups.set(minuteKey, []);
      }
      const group = minuteGroups.get(minuteKey);
      if (group) {
        group.push(row);
      }
    }

    const BATCH_SIZE = 25;
    const batches: Seizure[][] = [];
    const currentBatch: Seizure[] = [];

    for (const [, rows] of minuteGroups) {
      rows.forEach((row, index) => {
        const adjustedDate = new Date(row.date);
        adjustedDate.setSeconds(index);

        const seizure: Seizure = {
          patient: patientId,
          date: pacificToUtcTimestamp(adjustedDate),
          duration: row.duration,
          notes: row.notes,
        };

        currentBatch.push(seizure);

        if (currentBatch.length === BATCH_SIZE) {
          batches.push([...currentBatch]);
          currentBatch.length = 0;
        }
      });
    }

    if (currentBatch.length > 0) {
      batches.push([...currentBatch]);
    }

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

        if (result.UnprocessedItems?.[SEIZURES_TABLE]?.length) {
          console.error(
            "Error: Some items were not processed by DynamoDB:",
            JSON.stringify(result.UnprocessedItems[SEIZURES_TABLE], null, 2),
          );
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
        for (const seizure of batch) {
          const errorDetails =
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : "Unknown error";
          failedRows.push(
            `DynamoDB batch error (${errorDetails}): date=${seizure.date}, duration=${seizure.duration}, notes=${seizure.notes}`,
          );
        }
      }
    }

    revalidatePath("/");
    revalidatePath("/graphs");
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
    await assertOwnsPatient(patientId);

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
    await assertOwnsPatient(medicationChange.id);

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
    await assertOwnsPatient(patientId);

    const command = new DeleteCommand({
      TableName: MEDICATION_CHANGES_TABLE,
      Key: {
        id: patientId,
        date,
      },
    });

    await docClient.send(command);
    revalidatePath("/");
    revalidatePath("/graphs");
    return { success: true };
  } catch (error) {
    console.error("Error deleting medication change:", error);
    return { error: "Failed to delete medication change" };
  }
}

export async function deleteSeizure(patientId: string, date: number) {
  try {
    await assertOwnsPatient(patientId);

    const getCommand = new GetCommand({
      TableName: SEIZURES_TABLE,
      Key: {
        patient: patientId,
        date,
      },
    });

    const response = await docClient.send(getCommand);
    const seizure = response.Item as Seizure | undefined;

    if (!seizure) {
      return { error: "Seizure not found" };
    }

    const deleteCommand = new DeleteCommand({
      TableName: SEIZURES_TABLE,
      Key: {
        patient: patientId,
        date,
      },
    });

    await docClient.send(deleteCommand);
    revalidatePath("/");
    revalidatePath("/graphs");
    return { success: true };
  } catch (error) {
    console.error("Error deleting seizure:", error);
    return { error: "Failed to delete seizure" };
  }
}

// ---------------------------------------------------------------------------
// Script helpers
// ---------------------------------------------------------------------------

export async function createDefaultPatientForUser(
  userId: string,
  name: string,
) {
  const trimmedName = name.trim();
  const existing = await docClient.send(
    new ScanCommand({
      TableName: PATIENTS_TABLE,
      ProjectionExpression: "id",
    }),
  );
  const existingIds = new Set(
    (existing.Items ?? []).map((item) => String(item.id)),
  );

  const patient: Patient = {
    id: generateUniquePatientId(trimmedName, existingIds),
    name: trimmedName,
    ownerId: userId,
    allowedUserIds: [userId],
    createdAt: Date.now(),
  };

  const command = new PutCommand({
    TableName: PATIENTS_TABLE,
    Item: patient,
  });

  await docClient.send(command);
  return patient;
}
