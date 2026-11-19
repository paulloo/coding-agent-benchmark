import { getPrisma } from "@/server/prisma";
import { createBenchmarkRun } from "@/server/create-run";
import { errorResponse, json, readJsonBody } from "@/server/http";
import { createRunSchema } from "@/server/validation";

export async function GET() {
  try {
    const runs = await getPrisma().benchmarkRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { agentRuns: true } } },
    });
    return json({ runs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createRunSchema.parse(await readJsonBody(request));
    const run = await createBenchmarkRun(getPrisma(), input);
    return json({ run }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
