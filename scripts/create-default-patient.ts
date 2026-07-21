import { resolve } from "node:path";
import { config } from "dotenv";

const envPath = resolve(__dirname, "../.env.local");
config({ path: envPath });

if (
  !process.env.AWS_REGION ||
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY
) {
  console.error("Missing required AWS environment variables");
  process.exit(1);
}

import { createDefaultPatientForUser } from "@/app/actions";
import { runScript } from "./utils";

function getArgs(): { ownerEmail: string; name: string } {
  const ownerEmail = process.argv[2] || process.env.OWNER_EMAIL;
  const name = process.argv[3] || process.env.DEFAULT_PATIENT_NAME || "Kat";
  if (!ownerEmail) {
    console.error(
      "Usage: OWNER_EMAIL=<email> npx ts-node -r tsconfig-paths/register -P scripts/tsconfig.json scripts/create-default-patient.ts [patient-name]",
    );
    console.error(
      "Or pass the owner email as the first argument and optional patient name as the second.",
    );
    process.exit(1);
  }
  return { ownerEmail, name };
}

async function main() {
  const { ownerEmail, name } = getArgs();
  await createDefaultPatientForUser(ownerEmail, name);
  console.log(`Default patient '${name}' created for ${ownerEmail}`);
}

runScript("Create Default Patient", main);
