import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { SEIZURES_TABLE } from "./dynamodb";

export interface Seizure {
  patient: string;
  date: number; // Unix epoch
  duration: number;
  notes: string;
}

export const createTableCommand = new CreateTableCommand({
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
