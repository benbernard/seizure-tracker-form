import { NextResponse } from "next/server";
import { docClient, SEIZURES_TABLE } from "@/lib/aws/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function GET() {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const command = new QueryCommand({
      TableName: SEIZURES_TABLE,
      KeyConditionExpression: "#timestamp >= :oneDayAgo",
      ExpressionAttributeNames: {
        "#timestamp": "timestamp",
      },
      ExpressionAttributeValues: {
        ":oneDayAgo": oneDayAgo.toISOString(),
      },
      ScanIndexForward: false, // This will return items in descending order (newest first)
    });

    console.log("BENBEN: Querying DynamoDB for seizures in the last 24 hours");
    const response = await docClient.send(command);

    return NextResponse.json({ seizures: response.Items || [] });
  } catch (error) {
    console.error("BENBEN: Error fetching seizures:", error);
    return NextResponse.json(
      { error: "Failed to fetch seizures" },
      { status: 500 },
    );
  }
}
