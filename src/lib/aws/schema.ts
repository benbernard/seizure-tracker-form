export interface Seizure {
  patient: string;
  date: number; // Unix epoch
  duration: number;
  notes: string;
}

export interface Settings {
  id: string;
  enableLatenode: boolean;
  currentPatientId?: string;
  updatedAt: number; // Unix epoch
}

export interface Patient {
  id: string;
  name: string;
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
