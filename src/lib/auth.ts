import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { PATIENTS_TABLE } from "./aws/confs";
import { docClient } from "./aws/dynamodb";
import type { Patient } from "./aws/schema";
import { auth } from "./clerk";

export async function getCurrentUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export async function getPatientById(
  patientId: string,
): Promise<Patient | undefined> {
  const command = new GetCommand({
    TableName: PATIENTS_TABLE,
    Key: { id: patientId },
  });
  const response = await docClient.send(command);
  return response.Item as Patient | undefined;
}

export function patientIsOwnedBy(patient: Patient, userId: string): boolean {
  if (patient.ownerId === userId) return true;
  return (patient.allowedUserIds ?? []).includes(userId);
}

export async function assertOwnsPatient(patientId: string): Promise<Patient> {
  const userId = await getCurrentUserId();
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }
  if (!patientIsOwnedBy(patient, userId)) {
    throw new Error("Forbidden");
  }
  return patient;
}
