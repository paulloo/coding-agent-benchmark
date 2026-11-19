import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json } from "@/server/http";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const prisma = getPrisma();
    const run = await prisma.benchmarkRun.findUnique({
      where: { id: runId },
      include: {
        agentRuns: {
          include: {
            agent: true,
            task: true,
            promptVersion: { select: { id: true, version: true, promptId: true } },
            score: true,
            evaluations: { orderBy: { checkKey: "asc" } },
            artifacts: true,
          },
          orderBy: [{ repetitionIndex: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!run) {
      throw new HttpError(404, "评测批次不存在");
    }

    return json({
      generatedAt: new Date().toISOString(),
      run: {
        id: run.id,
        name: run.name,
        status: run.status,
        mode: run.mode,
        initialCommit: run.initialCommit,
        configuration: run.configuration,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt,
      },
      agentRuns: run.agentRuns,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
