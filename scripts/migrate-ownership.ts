import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createClerkClient } from "@clerk/backend";
import { PATIENTS_TABLE, SETTINGS_TABLE } from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

async function getOwnerUserId(): Promise<string> {
  const arg = process.argv[2];
  const envUserId = process.env.OWNER_USER_ID;
  const envEmail = process.env.OWNER_EMAIL;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (arg) {
    return arg;
  }
  if (envUserId) {
    return envUserId;
  }

  const email = arg || envEmail;
  if (!email) {
    console.error(
      "Usage: OWNER_EMAIL=<email> npx ts-node -r tsconfig-paths/register -P scripts/tsconfig.json scripts/migrate-ownership.ts",
    );
    console.error("Or: OWNER_USER_ID=<clerk-user-id> ...");
    console.error("Or pass the email or Clerk userId as the first argument.");
    process.exit(1);
  }

  if (!secretKey) {
    console.error("CLERK_SECRET_KEY is required to look up a user by email");
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey });
  const { data } = await clerk.users.getUserList({
    emailAddress: [email.toLowerCase().trim()],
  });
  if (data.length === 0) {
    console.error(`No Clerk user found with email: ${email}`);
    process.exit(1);
  }
  if (data.length > 1) {
    console.error(`Multiple Clerk users found with email: ${email}`);
    process.exit(1);
  }

  console.log(`Resolved ${email} to Clerk userId ${data[0].id}`);
  return data[0].id;
}

async function main() {
  const ownerUserId = await getOwnerUserId();
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
