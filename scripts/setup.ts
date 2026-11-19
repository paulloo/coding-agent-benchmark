import { copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { delay, runStep } from "./lib";

async function ensureEnvFile(): Promise<void> {
  try {
    await access(".env", constants.F_OK);
    console.log("[env] .env already exists");
  } catch {
    await copyFile(".env.example", ".env");
    console.log("[env] created .env from .env.example");
  }
}

async function waitForPostgres(attempts = 40): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const status = runStep(
      "wait-for-postgres",
      "docker",
      ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "cab", "-d", "cab_benchmark"],
      { allowFailure: true, quiet: true },
    );
    if (status === 0) {
      console.log("[db] postgres is ready");
      return;
    }
    await delay(1500);
  }
  throw new Error("PostgreSQL did not become ready in time. Check `docker compose logs postgres`.");
}

async function main(): Promise<void> {
  await ensureEnvFile();

  runStep("docker", "docker", ["compose", "up", "-d", "postgres"]);
  await waitForPostgres();

  runStep("prisma-generate", "pnpm", ["exec", "prisma", "generate"]);
  runStep("prisma-migrate", "pnpm", ["exec", "prisma", "migrate", "deploy"]);
  runStep("seed", "pnpm", ["db:seed"]);

  console.log("\nSetup complete. Start the dashboard with `pnpm dev`.");
}

main().catch((error: unknown) => {
  console.error("\nSetup failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
