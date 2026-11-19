import "dotenv/config";
import { createPrismaClient, Prisma } from "@cab/db";
import { createAllAdapters } from "@cab/adapters";
import { buildInputSchema, loadPrompts } from "@cab/prompts";

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    const adapters = createAllAdapters();
    for (const adapter of adapters) {
      const capabilities = adapter.getCapabilities() as unknown as Prisma.InputJsonValue;
      await prisma.agent.upsert({
        where: { slug: adapter.id },
        create: {
          slug: adapter.id,
          name: adapter.name,
          vendor: adapter.vendor,
          category: "CLI",
          version: "unknown",
          adapter: adapter.id,
          enabled: true,
          capabilities,
        },
        update: {
          name: adapter.name,
          vendor: adapter.vendor,
          adapter: adapter.id,
          capabilities,
        },
      });
      console.log(`agent: ${adapter.name} (${adapter.id})`);
    }

    const prompts = await loadPrompts();
    for (const loaded of prompts) {
      const { manifest, content } = loaded;
      const prompt = await prisma.prompt.upsert({
        where: { slug: manifest.id },
        create: {
          slug: manifest.id,
          name: manifest.name,
          category: manifest.category,
          description: manifest.description,
        },
        update: {
          name: manifest.name,
          category: manifest.category,
          description: manifest.description,
        },
      });

      const promptVersion = await prisma.promptVersion.upsert({
        where: {
          promptId_version: { promptId: prompt.id, version: manifest.version },
        },
        create: {
          promptId: prompt.id,
          version: manifest.version,
          content,
          inputSchema: buildInputSchema(manifest),
          expectedOutput: manifest.expectedOutput,
          scoringRules: manifest.scoringRules,
        },
        update: {
          content,
          inputSchema: buildInputSchema(manifest),
          expectedOutput: manifest.expectedOutput,
          scoringRules: manifest.scoringRules,
        },
      });

      await prisma.benchmarkTask.upsert({
        where: { key: manifest.id },
        create: {
          key: manifest.id,
          name: manifest.name,
          description: manifest.description,
          category: manifest.category,
          promptVersionId: promptVersion.id,
          weight: manifest.weight,
          timeoutSeconds: manifest.timeoutSeconds,
          baseRef: manifest.baseRef,
          requiredChecks: manifest.requiredChecks,
          enabled: true,
        },
        update: {
          name: manifest.name,
          description: manifest.description,
          category: manifest.category,
          promptVersionId: promptVersion.id,
          weight: manifest.weight,
          timeoutSeconds: manifest.timeoutSeconds,
          baseRef: manifest.baseRef,
          requiredChecks: manifest.requiredChecks,
        },
      });

      console.log(
        `task: ${manifest.id} (weight ${manifest.weight}, prompt v${manifest.version}, base ${manifest.baseRef ?? "inherit"})`,
      );
    }

    const [agentCount, taskCount] = await Promise.all([
      prisma.agent.count(),
      prisma.benchmarkTask.count(),
    ]);
    console.log(`\nseed complete: ${agentCount} agents, ${taskCount} tasks`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("seed failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
