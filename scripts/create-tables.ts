import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import {
  SEIZURES_TABLE,
  SETTINGS_TABLE,
  PATIENTS_TABLE,
  MEDICATION_CHANGES_TABLE,
} from "../src/lib/aws/confs";
import { runScript, createDynamoClient } from "./utils";

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

const createMedicationChangesTableCommand = new CreateTableCommand({
  TableName: MEDICATION_CHANGES_TABLE,
  KeySchema: [
    { AttributeName: "id", KeyType: "HASH" }, // Partition key (patientId)
    { AttributeName: "date", KeyType: "RANGE" }, // Sort key
  ],
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" },
    { AttributeName: "date", AttributeType: "N" },
  ],
  BillingMode: "PAY_PER_REQUEST",
});

async function createTableIfNotExists(
  client: ReturnType<typeof createDynamoClient>,
  command: CreateTableCommand,
) {
  const tableName = command.input.TableName;
  try {
    console.log(`Creating ${tableName} table...`);
    await client.send(command);
    console.log(`${tableName} table created successfully!`);
    return true;
  } catch (error) {
    // DynamoDB errors have this shape
    type DynamoError = {
      $metadata?: { httpStatusCode?: number };
      __type?: string;
    };

    const dynamoError = error as DynamoError;
    if (
      dynamoError?.$metadata?.httpStatusCode === 400 &&
      dynamoError.__type ===
        "com.amazonaws.dynamodb.v20120810#ResourceInUseException"
    ) {
      console.log(`${tableName} table already exists, skipping creation.`);
      return true;
    }
    throw error;
  }
}

async function main() {
  const client = createDynamoClient();

  await createTableIfNotExists(client, createSeizuresTableCommand);
  await createTableIfNotExists(client, createSettingsTableCommand);
  await createTableIfNotExists(client, createPatientsTableCommand);
  await createTableIfNotExists(client, createMedicationChangesTableCommand);
}

runScript("Create Tables", main);
