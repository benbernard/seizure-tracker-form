"use server";

import { docClient, SEIZURES_TABLE } from "@/lib/aws/dynamodb";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Seizure, Settings, Patient } from "@/lib/aws/schema";
import { revalidatePath } from "next/cache";
import { SETTINGS_TABLE, PATIENTS_TABLE } from "@/lib/aws/confs";
import axios from "axios";

const SETTINGS_ID = "global";

export async function getSettings() {
  try {
    const command = new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: {
        id: SETTINGS_ID,
      },
    });

    console.log("BENBEN: Fetching settings");
    const response = await docClient.send(command);
    return (
      (response.Item as Settings) || {
        id: SETTINGS_ID,
        enableLatenode: false,
        updatedAt: Date.now() / 1000,
      }
    );
  } catch (error) {
    console.error("BENBEN: Error fetching settings:", error);
    throw new Error("Failed to fetch settings");
  }
}

export async function updateSettings({
  enableLatenode,
}: { enableLatenode: boolean }) {
  try {
    const settings: Settings = {
      id: SETTINGS_ID,
      enableLatenode,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const command = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: settings,
    });

    console.log("BENBEN: Updating settings:", settings);
    await docClient.send(command);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("BENBEN: Error updating settings:", error);
    return { error: "Failed to update settings" };
  }
}

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
    const seizure: Seizure = {
      patient: "kat",
      date: Math.floor(Date.now() / 1000),
      duration: Number(duration),
      notes: notes?.trim() || "WebForm",
    };

    console.log("BENBEN: Creating seizure:", seizure);

    const command = new PutCommand({
      TableName: SEIZURES_TABLE,
      Item: seizure,
    });

    await docClient.send(command);

    // Check settings and call webhook if enabled
    const settings = await getSettings();
    if (settings.enableLatenode) {
      console.log("BENBEN: Latenode webhook enabled, sending data");
      await axios.post(
        "https://webhook.latenode.com/11681/prod/84908c3c-1283-4f18-9ef3-d773bd08ad6e",
        {
          duration,
          notes: `WebForm: ${notes?.trim() || ""}`,
        },
      );
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("BENBEN: Error creating seizure:", error);
    return { error: "Failed to create seizure" };
  }
}

export async function createDefaultPatient() {
  try {
    const command = new PutCommand({
      TableName: PATIENTS_TABLE,
      Item: {
        id: "kat",
        name: "Kat",
        createdAt: Date.now(),
      } as Patient,
    });

    await docClient.send(command);
    console.log("BENBEN: Created default patient");
  } catch (error) {
    console.error("BENBEN: Error creating default patient:", error);
    throw new Error("Failed to create default patient");
  }
}

export async function getPatients() {
  try {
    const command = new ScanCommand({
      TableName: PATIENTS_TABLE,
    });

    const response = await docClient.send(command);
    return response.Items as Patient[];
  } catch (error) {
    console.error("BENBEN: Error getting patients:", error);
    throw new Error("Failed to get patients");
  }
}

export async function updateCurrentPatient(patientId: string) {
  try {
    const command = new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: {
        id: "global",
        enableLatenode: false,
        currentPatientId: patientId,
        updatedAt: Date.now(),
      } as Settings,
    });

    await docClient.send(command);
    revalidatePath("/");
  } catch (error) {
    console.error("BENBEN: Error updating current patient:", error);
    throw new Error("Failed to update current patient");
  }
}
