import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  MEDICATION_CHANGES_TABLE,
  PATIENTS_TABLE,
  SEIZURES_TABLE,
  SETTINGS_TABLE,
} from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

const BACKUP_DIR = resolve(__dirname, "../backups");

interface BackupManifest {
  timestamp: string;
  tables: Record<
    string,
    {
      file: string;
      count: number;
    }
  >;
}

async function scanTable(
  client: ReturnType<typeof createDynamoClient>,
  tableName: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const command = new ScanCommand({
      TableName: tableName,
      ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
    });
    const response = await client.send(command);
    if (response.Items) {
      items.push(...response.Items);
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function main() {
  const client = createDynamoClient();
  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().split("T")[0];
  const manifest: BackupManifest = {
    timestamp: new Date().toISOString(),
    tables: {},
  };

  const tables: Record<string, string> = {
    seizures: SEIZURES_TABLE,
    patients: PATIENTS_TABLE,
    settings: SETTINGS_TABLE,
    medicationChanges: MEDICATION_CHANGES_TABLE,
  };

  for (const [key, tableName] of Object.entries(tables)) {
    console.log(`Scanning ${tableName}...`);
    const items = await scanTable(client, tableName);
    const fileName = `${key}-${timestamp}.json`;
    const filePath = resolve(BACKUP_DIR, fileName);
    await writeFile(filePath, JSON.stringify(items, null, 2));
    manifest.tables[key] = { file: fileName, count: items.length };
    console.log(`  Backed up ${items.length} items to ${fileName}`);
  }

  const manifestPath = resolve(BACKUP_DIR, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to ${manifestPath}`);
}

runScript("Backup Tables", main);
