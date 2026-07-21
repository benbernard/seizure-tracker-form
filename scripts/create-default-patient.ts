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

function getArgs(): { userId: string; name: string } {
  const userId = process.argv[2] || process.env.OWNER_USER_ID;
  const name = process.argv[3] || process.env.DEFAULT_PATIENT_NAME || "Kat";
  if (!userId) {
    console.error(
      "Usage: OWNER_USER_ID=<clerk-user-id> npx ts-node -r tsconfig-paths/register -P scripts/tsconfig.json scripts/create-default-patient.ts [patient-name]",
    );
    console.error(
      "Or pass the Clerk userId as the first argument and optional patient name as the second.",
    );
    process.exit(1);
  }
  return { userId, name };
}

async function main() {
  const { userId, name } = getArgs();
  await createDefaultPatientForUser(userId, name);
  console.log(`Default patient '${name}' created for user ${userId}`);
}

runScript("Create Default Patient", main);
