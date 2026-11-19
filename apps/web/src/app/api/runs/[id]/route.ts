import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json } from "@/server/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = await getPrisma().benchmarkRun.findUnique({
      where: { id },
      include: {
        agentRuns: {
          include: { agent: true, task: true, score: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!run) {
      throw new HttpError(404, "评测批次不存在");
    }
    return json({ run });
  } catch (error) {
    return errorResponse(error);
  }
}
