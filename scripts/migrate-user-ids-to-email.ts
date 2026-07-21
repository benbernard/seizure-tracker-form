import {
  DeleteCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createClerkClient } from "@clerk/backend";
import { PATIENTS_TABLE, SETTINGS_TABLE } from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

const BATCH_SIZE = 100;

async function resolveEmail(
  clerk: ReturnType<typeof createClerkClient> | null,
  userId: string,
): Promise<string | null> {
  if (userId.includes("@")) {
    return userId.toLowerCase().trim();
  }

  if (process.env.LOCAL_AUTH_USER_ID) {
    return `${userId}@local`;
  }

  if (!clerk || !process.env.CLERK_SECRET_KEY) {
    console.error(
      `Cannot resolve ${userId} to email: no Clerk client available`,
    );
    return null;
  }

  try {
    const { data } = await clerk.users.getUserList({ userId: [userId] });
    if (data.length === 0) {
      console.error(`No Clerk user found for id: ${userId}`);
      return null;
    }
    const user = data[0];
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    if (!email) {
      console.error(`No email found for Clerk user: ${userId}`);
      return null;
    }
    return email.toLowerCase().trim();
  } catch (error) {
    console.error(`Error resolving ${userId} to email:`, error);
    return null;
  }
}

async function main() {
  const client = createDynamoClient();
  const clerk = process.env.CLERK_SECRET_KEY
    ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    : null;

  const cache = new Map<string, string | null>();

  async function resolveCached(userId: string): Promise<string | null> {
    if (!cache.has(userId)) {
      cache.set(userId, await resolveEmail(clerk, userId));
    }
    return cache.get(userId) ?? null;
  }

  // 1. Migrate settings records
  console.log("Scanning settings records...");
  const settingsScan = await client.send(
    new ScanCommand({ TableName: SETTINGS_TABLE }),
  );
  const settingsItems = (settingsScan.Items ?? []) as {
    id: string;
    currentPatientId?: string;
    updatedAt: number;
  }[];
  const settingsToMigrate: {
    oldId: string;
    newId: string;
    item: (typeof settingsItems)[number];
  }[] = [];

  for (const item of settingsItems) {
    if (item.id.includes("@")) continue;
    const email = await resolveCached(item.id);
    if (!email) {
      console.error(
        `Skipping settings record ${item.id}: could not resolve email`,
      );
      continue;
    }
    if (email === item.id) continue;
    settingsToMigrate.push({ oldId: item.id, newId: email, item });
  }

  console.log(`Migrating ${settingsToMigrate.length} settings records...`);
  for (const { oldId, newId, item } of settingsToMigrate) {
    await client.send(
      new PutCommand({
        TableName: SETTINGS_TABLE,
        Item: { ...item, id: newId },
      }),
    );
    await client.send(
      new DeleteCommand({
        TableName: SETTINGS_TABLE,
        Key: { id: oldId },
      }),
    );
    console.log(`Migrated settings ${oldId} -> ${newId}`);
  }

  // 2. Migrate patient ownership
  console.log("Scanning patients...");
  const patientsScan = await client.send(
    new ScanCommand({ TableName: PATIENTS_TABLE }),
  );
  const patients = (patientsScan.Items ?? []) as {
    id: string;
    ownerId: string;
    allowedUserIds?: string[];
  }[];
  let patientsMigrated = 0;

  for (const patient of patients) {
    let changed = false;
    const newOwnerId = patient.ownerId.includes("@")
      ? patient.ownerId.toLowerCase().trim()
      : await resolveCached(patient.ownerId);
    if (newOwnerId && newOwnerId !== patient.ownerId) {
      patient.ownerId = newOwnerId;
      changed = true;
    }

    const newAllowed: string[] = [];
    if (patient.allowedUserIds) {
      for (const userId of patient.allowedUserIds) {
        const email = userId.includes("@")
          ? userId.toLowerCase().trim()
          : await resolveCached(userId);
        if (email) {
          newAllowed.push(email);
          if (email !== userId) changed = true;
        } else {
          console.error(
            `Skipping allowed user ${userId} for patient ${patient.id}: could not resolve email`,
          );
        }
      }
    }

    if (changed) {
      await client.send(
        new UpdateCommand({
          TableName: PATIENTS_TABLE,
          Key: { id: patient.id },
          UpdateExpression:
            "SET ownerId = :ownerId, allowedUserIds = :allowedUserIds",
          ExpressionAttributeValues: {
            ":ownerId": patient.ownerId,
            ":allowedUserIds": newAllowed,
          },
        }),
      );
      patientsMigrated++;
      console.log(
        `Migrated patient ${patient.id}: ownerId=${patient.ownerId}, allowedUserIds=${newAllowed.join(", ")}`,
      );
    }
  }

  console.log(`Migrated ${patientsMigrated} patients.`);
  console.log("Migration complete.");
}

runScript("Migrate User IDs to Email", main);
