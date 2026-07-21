import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { createDynamoClient, runScript } from "./utils";

const MAX_RETRIES = 60;
const DELAY_MS = 500;

async function main() {
  const client = createDynamoClient();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log("DynamoDB Local is ready");
      return;
    } catch (error) {
      console.log(`Waiting for DynamoDB Local... (${attempt}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  throw new Error("DynamoDB Local did not become ready in time");
}

runScript("Wait for DynamoDB", main);
