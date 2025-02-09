import { config } from "dotenv";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { MedicationChange } from "@/lib/aws/schema";
import { MEDICATION_CHANGES_TABLE } from "@/lib/aws/confs";

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

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const medicationChanges = [
  { date: "2024-09-19", medication: "Pheno", dosage: "1.5 tabs" },
  { date: "2024-09-21", medication: "Clobazam", dosage: "3ml" },
  { date: "2024-09-26", medication: "Clobazam", dosage: "2ml" },
  { date: "2024-10-01", medication: "Clobazam", dosage: "1ml" },
  { date: "2024-10-04", medication: "Clobazam", dosage: "3ml" },
  { date: "2024-10-07", medication: "Clobazam", dosage: "2ml" },
  { date: "2024-10-08", medication: "Clobazam", dosage: "3ml" },
  { date: "2024-10-17", medication: "Clobazam", dosage: "4ml" },
  { date: "2024-10-30", medication: "Pheno", dosage: "2 tabs" },
  { date: "2025-02-06", medication: "Epidiolex", dosage: "0.3ml" },
];

async function importMedicationChanges() {
  console.log("Starting medication changes import...");

  for (const change of medicationChanges) {
    const medicationChange: MedicationChange = {
      id: "kat", // Using the default patient ID
      date: Math.floor(new Date(change.date).getTime() / 1000),
      medication: change.medication,
      dosage: change.dosage,
      type: "adjust", // Setting all as adjustments since we don't have type info
      notes: "Bulk import",
    };

    try {
      const command = new PutCommand({
        TableName: MEDICATION_CHANGES_TABLE,
        Item: medicationChange,
      });
      await docClient.send(command);
      console.log(
        `Successfully imported change for ${change.date}: ${change.medication} ${change.dosage}`,
      );
    } catch (error) {
      console.error(`Error importing change for ${change.date}:`, error);
    }
  }

  console.log("Import completed!");
}

// Run the import
importMedicationChanges().catch((error) => {
  console.error("Failed to import medication changes:", error);
  process.exit(1);
});
