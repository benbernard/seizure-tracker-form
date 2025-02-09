import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { config } from "dotenv";
import { resolve } from "node:path";
import {
  SEIZURES_TABLE,
  SETTINGS_TABLE,
  PATIENTS_TABLE,
} from "../src/lib/aws/confs";

// Load environment variables from .env.local
config({ path: resolve(__dirname, "../.env.local") });

if (
  !process.env.AWS_REGION ||
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY
) {
  console.error("Missing required AWS environment variables");
  process.exit(1);
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const createSeizuresTableCommand = new CreateTableCommand({
  TableName: SEIZURES_TABLE,
  KeySchema: [
    { AttributeName: "patient", KeyType: "HASH" }, // Partition key
    { AttributeName: "date", KeyType: "RANGE" }, // Sort key
  ],
  AttributeDefinitions: [
    { AttributeName: "patient", AttributeType: "S" },
    { AttributeName: "date", AttributeType: "N" },
  ],
  BillingMode: "PAY_PER_REQUEST", // On-demand capacity mode
});

const createSettingsTableCommand = new CreateTableCommand({
  TableName: SETTINGS_TABLE,
  KeySchema: [
    { AttributeName: "id", KeyType: "HASH" }, // Partition key
  ],
  AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  BillingMode: "PAY_PER_REQUEST", // On-demand capacity mode
});

const createPatientsTableCommand = new CreateTableCommand({
  TableName: PATIENTS_TABLE,
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  BillingMode: "PAY_PER_REQUEST",
});

async function createTableIfNotExists(command: CreateTableCommand) {
  const tableName = command.input.TableName;
  try {
    console.log(`Creating ${tableName} table...`);
    await client.send(command);
    console.log(`${tableName} table created successfully!`);
    return true;
  } catch (error: any) {
    if (
      error?.$metadata?.httpStatusCode === 400 &&
      error.__type === "com.amazonaws.dynamodb.v20120810#ResourceInUseException"
    ) {
      console.log(`${tableName} table already exists, skipping creation.`);
      return true;
    }
    throw error;
  }
}

async function createTables() {
  try {
    console.log("Creating tables...");

    await createTableIfNotExists(createSeizuresTableCommand);
    await createTableIfNotExists(createSettingsTableCommand);
    await createTableIfNotExists(createPatientsTableCommand);

    console.log("All tables created/verified successfully!");
  } catch (error) {
    console.error("Error creating tables:", error);
    process.exit(1);
  }
}

createTables();
