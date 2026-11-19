import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json } from "@/server/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prisma = getPrisma();
    const run = await prisma.benchmarkRun.findUnique({ where: { id } });
    if (!run) {
      throw new HttpError(404, "评测批次不存在");
    }

    const agentRuns = await prisma.agentRun.findMany({
      where: { benchmarkRunId: id },
      include: {
        agent: { select: { id: true, slug: true, name: true, vendor: true } },
        task: { select: { id: true, key: true, name: true } },
        score: true,
        evaluations: { orderBy: { checkKey: "asc" } },
      },
      orderBy: [{ repetitionIndex: "asc" }, { createdAt: "asc" }],
    });

    return json({ run, results: agentRuns });
  } catch (error) {
    return errorResponse(error);
  }
}
