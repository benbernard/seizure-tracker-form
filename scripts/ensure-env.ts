import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const envLocal = resolve(".env.local");
  const envExample = resolve(".env.example");

  if (existsSync(envLocal)) {
    console.log(".env.local already exists, skipping copy");
    return;
  }

  await copyFile(envExample, envLocal);
  console.log("Created .env.local from .env.example");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
