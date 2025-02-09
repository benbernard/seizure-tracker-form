// Load environment variables first
import { config } from "dotenv";
import { resolve } from "node:path";

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

// Import after environment variables are loaded
import { createDefaultPatient } from "@/app/actions";

async function main() {
  try {
    await createDefaultPatient();
    console.log("Default patient 'Kat' created successfully");
  } catch (error) {
    console.error("Error creating default patient:", error);
    process.exit(1);
  }
}

main();
