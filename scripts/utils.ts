import { config } from "dotenv";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Loads environment variables from .env.local
 * @throws Error if required AWS environment variables are missing
 */
export function loadEnvVariables() {
  const envPath = resolve(__dirname, "../.env.local");
  config({ path: envPath });

  const requiredVars = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ];

  const missingVars = requiredVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required AWS environment variables: ${missingVars.join(", ")}`,
    );
  }
}

/**
 * Creates a DynamoDB document client with default configuration
 */
export function createDynamoClient() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION;

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error("AWS credentials not properly loaded");
  }

  const client = new DynamoDBClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}

/**
 * Script runner that handles common setup and error handling
 * @param name Name of the script for logging
 * @param fn The main script function to run
 */
export async function runScript(name: string, fn: () => Promise<void>) {
  console.log(`Starting ${name}...`);

  try {
    loadEnvVariables();
    await fn();
    console.log(`${name} completed successfully!`);
  } catch (error) {
    console.error(`BENBEN Error in ${name}:`, error);
    process.exit(1);
  }
}
