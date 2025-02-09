import { MEDICATION_CHANGES_TABLE } from "@/lib/aws/confs";
import type { MedicationChange } from "@/lib/aws/schema";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { createDynamoClient, runScript } from "./utils";

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

async function main() {
  const docClient = createDynamoClient();

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
      throw error; // Let runScript handle the error
    }
  }
}

runScript("Import Medication Changes", main);
