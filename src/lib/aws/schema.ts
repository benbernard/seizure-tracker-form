export interface Seizure {
  patient: string;
  date: number; // Unix epoch
  duration: number;
  notes: string;
}

export interface Settings {
  id: string; // Clerk userId
  currentPatientId?: string;
  updatedAt: number; // Unix epoch
}

export interface Patient {
  id: string;
  name: string;
  ownerId: string; // Clerk userId
  allowedUserIds?: string[]; // additional users who can manage this patient
  quickButtonSeconds?: number[]; // durations for the public quick-submit buttons
  archived?: boolean; // soft-delete flag
  createdAt: number;
}

export interface MedicationChange {
  id: string; // patientId
  date: number; // Unix timestamp
  medication: string; // Name of the medication
  dosage: string; // New dosage
  type: "start" | "stop" | "adjust"; // Type of change
  notes?: string; // Optional notes about the change
}

export const SETTINGS_TABLE =
  process.env.DYNAMODB_SETTINGS_TABLE || "seizure-settings";
