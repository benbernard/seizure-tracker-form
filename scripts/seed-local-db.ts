import { BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  PATIENTS_TABLE,
  SEIZURES_TABLE,
  SETTINGS_TABLE,
} from "../src/lib/aws/confs";
import type { Patient, Seizure, Settings } from "../src/lib/aws/schema";
import { generateUniquePatientId } from "../src/lib/utils/slug";
import { createDynamoClient, runScript } from "./utils";

const LOCAL_USER_ID = process.env.LOCAL_AUTH_USER_ID || "local-user";
const LOCAL_EMAIL = `${LOCAL_USER_ID}@local`;
const SEIZURE_COUNT = 5;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function createSampleSeizures(patientId: string): Seizure[] {
  const now = nowSeconds();
  const seizures: Seizure[] = [];

  for (let i = 0; i < SEIZURE_COUNT; i++) {
    const dayOffset = i * 24 * 60 * 60;
    const randomSeconds = Math.floor(Math.random() * 60 * 60);
    seizures.push({
      patient: patientId,
      date: now - dayOffset - randomSeconds,
      duration: Math.floor(Math.random() * 120) + 30,
      notes: "Seed data",
    });
  }

  return seizures;
}

async function main() {
  const client = createDynamoClient();

  const patient: Patient = {
    id: generateUniquePatientId("Local Patient", new Set()),
    name: "Local Patient",
    ownerId: LOCAL_EMAIL,
    allowedUserIds: [LOCAL_EMAIL],
    createdAt: Date.now(),
  };

  await client.send(
    new PutCommand({
      TableName: PATIENTS_TABLE,
      Item: patient,
    }),
  );

  const settings: Settings = {
    id: LOCAL_EMAIL,
    currentPatientId: patient.id,
    updatedAt: nowSeconds(),
  };

  await client.send(
    new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: settings,
    }),
  );

  const seizures = createSampleSeizures(patient.id);
  const batches = [];
  for (let i = 0; i < seizures.length; i += 25) {
    batches.push(seizures.slice(i, i + 25));
  }

  for (const batch of batches) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [SEIZURES_TABLE]: batch.map((seizure) => ({
            PutRequest: { Item: seizure },
          })),
        },
      }),
    );
  }

  console.log(`Created patient ${patient.id} for ${LOCAL_USER_ID}`);
  console.log(`Inserted ${seizures.length} sample seizures`);
}

runScript("Seed Local DB", main);
