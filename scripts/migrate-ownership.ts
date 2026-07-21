import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PATIENTS_TABLE, SETTINGS_TABLE } from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

function getOwnerEmail(): string {
  const arg = process.argv[2];
  const envEmail = process.env.OWNER_EMAIL;
  const email = (arg || envEmail)?.toLowerCase().trim();

  if (!email) {
    console.error(
      "Usage: OWNER_EMAIL=<email> npx ts-node -r tsconfig-paths/register -P scripts/tsconfig.json scripts/migrate-ownership.ts",
    );
    console.error("Or pass the owner email as the first argument.");
    process.exit(1);
  }

  return email;
}

async function main() {
  const ownerEmail = getOwnerEmail();
  const client = createDynamoClient();

  console.log(`Migrating ownership to user: ${ownerEmail}`);

  // 1. Ensure the "kat" patient exists and has ownerId
  const getKatCommand = new GetCommand({
    TableName: PATIENTS_TABLE,
    Key: { id: "kat" },
  });
  const katResponse = await client.send(getKatCommand);
  const existingKat = katResponse.Item;

  if (existingKat) {
    if (existingKat.ownerId === ownerEmail) {
      console.log("'kat' patient already owned by target user, skipping");
    } else {
      const updateCommand = new PutCommand({
        TableName: PATIENTS_TABLE,
        Item: {
          ...existingKat,
          ownerId: ownerEmail,
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
        ownerId: ownerEmail,
        createdAt: Date.now(),
      },
    });
    await client.send(createCommand);
    console.log("Created 'kat' patient with ownerId");
  }

  // 2. Create per-user settings record for the owner if it does not exist
  const getSettingsCommand = new GetCommand({
    TableName: SETTINGS_TABLE,
    Key: { id: ownerEmail },
  });
  const settingsResponse = await client.send(getSettingsCommand);

  if (settingsResponse.Item) {
    console.log("Per-user settings record already exists, skipping");
  } else {
    const putSettingsCommand = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: {
        id: ownerEmail,
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
