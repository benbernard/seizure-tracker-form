// Load environment variables first
import { config } from "dotenv";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "../.env.local");
console.log("BENBEN: Loading environment from:", envPath);
config({ path: envPath });

console.log("BENBEN: Environment variables loaded:", {
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: `${process.env.AWS_ACCESS_KEY_ID?.slice(0, 5)}...`,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? "***" : undefined,
});

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
