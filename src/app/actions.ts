"use server";

import { docClient, SEIZURES_TABLE } from "@/lib/aws/dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Seizure } from "@/lib/aws/schema";
import { revalidatePath } from "next/cache";

export async function listSeizures() {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const command = new QueryCommand({
      TableName: SEIZURES_TABLE,
      KeyConditionExpression: "#patient = :patient AND #date >= :oneDayAgo",
      ExpressionAttributeNames: {
        "#patient": "patient",
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":patient": "kat",
        ":oneDayAgo": oneDayAgo,
      },
      ScanIndexForward: false, // This will return items in descending order (newest first)
    });

    console.log(
      "BENBEN: Querying DynamoDB for seizures in the last 24 hours for patient: kat",
    );
    const response = await docClient.send(command);
    return { seizures: (response.Items as Seizure[]) || [] };
  } catch (error) {
    console.error("BENBEN: Error fetching seizures:", error);
    return { error: "Failed to fetch seizures" };
  }
}

export async function submitSeizure(duration: string, notes?: string) {
  try {
    // Add artificial delay to see loading state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const seizure: Seizure = {
      patient: "kat",
      date: Math.floor(Date.now() / 1000),
      duration: Number(duration),
      notes: notes ? `WebForm: ${notes.trim()}` : "",
    };

    console.log("BENBEN: Creating seizure:", seizure);

    const command = new PutCommand({
      TableName: SEIZURES_TABLE,
      Item: seizure,
    });

    await docClient.send(command);

    // TODO: Re-enable webhook call when ready
    // await axios.post(
    //   "https://webhook.latenode.com/11681/prod/84908c3c-1283-4f18-9ef3-d773bd08ad6e",
    //   {
    //     duration,
    //     notes: `WebForm: ${notes.trim()}`,
    //   },
    // );

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("BENBEN: Error creating seizure:", error);
    return { error: "Failed to create seizure" };
  }
}
