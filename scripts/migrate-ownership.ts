import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { PATIENTS_TABLE, SETTINGS_TABLE } from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

function getOwnerUserId(): string {
  const arg = process.argv[2];
  const env = process.env.OWNER_USER_ID;
  const ownerId = arg || env;
  if (!ownerId) {
    console.error(
      "Usage: OWNER_USER_ID=<clerk-user-id> npx ts-node -r tsconfig-paths/register -P scripts/tsconfig.json scripts/migrate-ownership.ts",
    );
    console.error("Or pass the Clerk userId as the first argument.");
    process.exit(1);
  }
  return ownerId;
}

async function main() {
  const ownerUserId = getOwnerUserId();
  const client = createDynamoClient();

  console.log(`Migrating ownership to user: ${ownerUserId}`);

  // 1. Ensure the "kat" patient exists and has ownerId
  const getKatCommand = new GetCommand({
    TableName: PATIENTS_TABLE,
    Key: { id: "kat" },
  });
  const katResponse = await client.send(getKatCommand);
  const existingKat = katResponse.Item;

  if (existingKat) {
    if (existingKat.ownerId === ownerUserId) {
      console.log("'kat' patient already owned by target user, skipping");
    } else {
      const updateCommand = new PutCommand({
        TableName: PATIENTS_TABLE,
        Item: {
          ...existingKat,
          ownerId: ownerUserId,
        },
      });
      await client.send(updateCommand);
      console.log("Updated 'kat' patient with ownerId");
    }
  } else {
    const createCommand = new PutCommand({
      TableName: PATIENTS_TABLE,
      Item: {
        id: "kat",
        name: "Kat",
        ownerId: ownerUserId,
        createdAt: Date.now(),
      },
    });
    await client.send(createCommand);
    console.log("Created 'kat' patient with ownerId");
  }

  // 2. Create per-user settings record for the owner if it does not exist
  const getSettingsCommand = new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { id: ownerUserId },
  });
  const settingsResponse = await client.send(getSettingsCommand);

  if (settingsResponse.Item) {
    console.log("Per-user settings record already exists, skipping");
  } else {
    const putSettingsCommand = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: {
        id: ownerUserId,
        currentPatientId: "kat",
        updatedAt: Math.floor(Date.now() / 1000),
      },
    });
    await client.send(putSettingsCommand);
    console.log("Created per-user settings record with currentPatientId 'kat'");
  }

  console.log("Migration complete.");
}

runScript("Migrate Ownership", main);
