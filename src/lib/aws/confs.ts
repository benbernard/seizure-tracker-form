// DynamoDB Table Names
export const SEIZURES_TABLE = process.env.DYNAMODB_SEIZURES_TABLE || "seizures";
export const SETTINGS_TABLE =
  process.env.DYNAMODB_SETTINGS_TABLE || "seizure-settings";
export const PATIENTS_TABLE = process.env.DYNAMODB_PATIENTS_TABLE || "patients";
export const MEDICATION_CHANGES_TABLE =
  process.env.DYNAMODB_MEDICATION_CHANGES_TABLE || "medication-changes";
