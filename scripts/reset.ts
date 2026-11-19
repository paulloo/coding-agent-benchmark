import { requireYes, runStep } from "./lib";

async function main(): Promise<void> {
  requireYes(process.argv.slice(2), "清空平台数据库并重新初始化所有数据");

  runStep("prisma-reset", "pnpm", ["exec", "prisma", "migrate", "reset", "--force"]);
  runStep("prisma-generate", "pnpm", ["exec", "prisma", "generate"]);
  runStep("seed", "pnpm", ["db:seed"]);

  console.log("\nReset complete.");
}

main().catch((error: unknown) => {
  console.error("\nReset failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
