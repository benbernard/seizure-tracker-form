import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  MEDICATION_CHANGES_TABLE,
  PATIENTS_TABLE,
  SEIZURES_TABLE,
  SETTINGS_TABLE,
} from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

const BACKUP_DIR = resolve(__dirname, "../backups");

const BATCH_SIZE = 25;

const tables: Record<string, string> = {
  seizures: SEIZURES_TABLE,
  patients: PATIENTS_TABLE,
  settings: SETTINGS_TABLE,
  medicationChanges: MEDICATION_CHANGES_TABLE,
};

async function restoreTable(
  client: ReturnType<typeof createDynamoClient>,
  tableName: string,
  items: Record<string, unknown>[],
) {
  console.log(`Restoring ${items.length} items into ${tableName}...`);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map((item) => ({
          PutRequest: { Item: item },
        })),
      },
    });

    const result = await client.send(command);
    if (result.UnprocessedItems?.[tableName]?.length) {
      console.error(
        `Unprocessed items in ${tableName}:`,
        result.UnprocessedItems[tableName],
      );
    }
  }
}

async function main() {
  const client = createDynamoClient();
  const manifestPath = resolve(BACKUP_DIR, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

  console.log(`Restoring from backup taken at ${manifest.timestamp}`);

  for (const [key, meta] of Object.entries(
    manifest.tables as Record<string, { file: string }>,
  )) {
    const tableName = tables[key];
    if (!tableName) {
      console.warn(`Unknown table key: ${key}, skipping`);
      continue;
    }
    const filePath = resolve(BACKUP_DIR, meta.file);
    const items = JSON.parse(await readFile(filePath, "utf-8"));
    await restoreTable(client, tableName, items);
  }

  console.log("Restore complete.");
}

runScript("Restore Tables", main);
