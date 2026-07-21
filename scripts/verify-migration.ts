import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { PATIENTS_TABLE, SETTINGS_TABLE } from "../src/lib/aws/confs";
import { createDynamoClient, runScript } from "./utils";

async function main() {
  const client = createDynamoClient();

  const patient = await client.send(
    new GetCommand({
      TableName: PATIENTS_TABLE,
      Key: { id: "kat" },
    }),
  );

  console.log("Patient 'kat':");
  console.log(JSON.stringify(patient.Item, null, 2));

  const settings = await client.send(
    new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { id: "user_2tJamNpO5LRR3PgYyzMtX8uX7qP" },
    }),
  );

  console.log("\nOwner settings record:");
  console.log(JSON.stringify(settings.Item, null, 2));
}

runScript("Verify Migration", main);
