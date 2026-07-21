import {
  BatchWriteCommand,
  DeleteCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  MEDICATION_CHANGES_TABLE,
  PATIENTS_TABLE,
  SEIZURES_TABLE,
  SETTINGS_TABLE,
} from "../src/lib/aws/confs";
import type { Patient } from "../src/lib/aws/schema";
import { generateUniquePatientId, slugify } from "../src/lib/utils/slug";
import { createDynamoClient, runScript } from "./utils";

const BATCH_SIZE = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export async function main() {
  const client = createDynamoClient();

  const patientsResponse = await client.send(
    new ScanCommand({ TableName: PATIENTS_TABLE }),
  );
  const patients = (patientsResponse.Items ?? []) as Patient[];

  if (patients.length === 0) {
    console.log("No patients to migrate.");
    return;
  }

  const allExistingIds = new Set(patients.map((p) => p.id));
  const migrationMap = new Map<string, string>();

  for (const patient of patients) {
    if (patient.id === slugify(patient.name)) {
      console.log(`Patient ${patient.id} already has a kebab ID, skipping`);
      continue;
    }
    const newId = generateUniquePatientId(patient.name, allExistingIds);
    allExistingIds.add(newId);
    migrationMap.set(patient.id, newId);
    console.log(`Migrating patient ${patient.id} -> ${newId}`);
  }

  if (migrationMap.size === 0) {
    console.log("All patients already use kebab IDs.");
    return;
  }

  for (const [oldId, newId] of migrationMap.entries()) {
    const patient = patients.find((p) => p.id === oldId);
    if (!patient) {
      console.error(`Could not find patient record for ${oldId}`);
      continue;
    }

    // Create the new patient record before moving related data.
    await client.send(
      new PutCommand({
        TableName: PATIENTS_TABLE,
        Item: { ...patient, id: newId },
      }),
    );

    // Migrate seizures.
    const seizuresResponse = await client.send(
      new QueryCommand({
        TableName: SEIZURES_TABLE,
        KeyConditionExpression: "#patient = :patient",
        ExpressionAttributeNames: { "#patient": "patient" },
        ExpressionAttributeValues: { ":patient": oldId },
      }),
    );
    const seizures = seizuresResponse.Items ?? [];
    const seizureBatches = chunk(seizures, BATCH_SIZE);
    for (const batch of seizureBatches) {
      await client.send(
        new BatchWriteCommand({
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
        }),
      );
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [SEIZURES_TABLE]: batch.map((item) => ({
              PutRequest: {
                Item: { ...item, patient: newId },
              },
            })),
          },
        }),
      );
    }
    console.log(
      `Migrated ${seizures.length} seizures for ${oldId} -> ${newId}`,
    );

    // Migrate medication changes.
    const medicationResponse = await client.send(
      new QueryCommand({
        TableName: MEDICATION_CHANGES_TABLE,
        KeyConditionExpression: "#id = :id",
        ExpressionAttributeNames: { "#id": "id" },
        ExpressionAttributeValues: { ":id": oldId },
      }),
    );
    const medicationChanges = medicationResponse.Items ?? [];
    const medicationBatches = chunk(medicationChanges, BATCH_SIZE);
    for (const batch of medicationBatches) {
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [MEDICATION_CHANGES_TABLE]: batch.map((item) => ({
              DeleteRequest: {
                Key: {
                  id: item.id,
                  date: item.date,
                },
              },
            })),
          },
        }),
      );
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [MEDICATION_CHANGES_TABLE]: batch.map((item) => ({
              PutRequest: {
                Item: { ...item, id: newId },
              },
            })),
          },
        }),
      );
    }
    console.log(
      `Migrated ${medicationChanges.length} medication changes for ${oldId} -> ${newId}`,
    );

    // Update settings records that point to the old patient ID.
    const settingsResponse = await client.send(
      new ScanCommand({ TableName: SETTINGS_TABLE }),
    );
    const settings = settingsResponse.Items ?? [];
    const matchingSettings = settings.filter(
      (item) => item.currentPatientId === oldId,
    );
    for (const setting of matchingSettings) {
      await client.send(
        new UpdateCommand({
          TableName: SETTINGS_TABLE,
          Key: { id: setting.id },
          UpdateExpression: "SET currentPatientId = :newId",
          ExpressionAttributeValues: { ":newId": newId },
        }),
      );
    }
    console.log(
      `Updated ${matchingSettings.length} settings records for ${oldId} -> ${newId}`,
    );

    // Remove the old patient record.
    await client.send(
      new DeleteCommand({
        TableName: PATIENTS_TABLE,
        Key: { id: oldId },
      }),
    );
  }

  console.log(`Migration complete. ${migrationMap.size} patient(s) migrated.`);
}

runScript("Migrate to Kebab IDs", main);
