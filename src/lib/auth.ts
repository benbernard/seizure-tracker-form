import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { clerkClient } from "@clerk/nextjs/server";
import { PATIENTS_TABLE } from "./aws/confs";
import { docClient } from "./aws/dynamodb";
import type { Patient } from "./aws/schema";
import { auth, isLocalAuth } from "./clerk";

export async function getCurrentUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export async function getCurrentUser(): Promise<{
  userId: string;
  email: string;
}> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (isLocalAuth()) {
    return { userId, email: `${userId}@local` };
  }

  const client = await clerkClient();
  const { data } = await client.users.getUserList({ userId: [userId] });
  const user = data[0];
  if (!user) {
    throw new Error("User not found");
  }
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";

  return { userId, email };
}

export function isSuperUser(email: string): boolean {
  const superEmails =
    process.env.SUPER_USER_EMAILS?.split(",").map((e) =>
      e.trim().toLowerCase(),
    ) ?? [];
  if (superEmails.length === 0) {
    return false;
  }
  return superEmails.includes(email.trim().toLowerCase());
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
  const { userId, email } = await getCurrentUser();
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }
  if (!patientIsOwnedBy(patient, userId) && !isSuperUser(email)) {
    throw new Error("Forbidden");
  }
  return patient;
}
