import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json } from "@/server/http";

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prisma = getPrisma();
    const run = await prisma.benchmarkRun.findUnique({ where: { id } });
    if (!run) {
      throw new HttpError(404, "评测批次不存在");
    }
    if (TERMINAL_STATUSES.has(run.status)) {
      throw new HttpError(409, `批次已处于 ${run.status} 状态，无法取消`);
    }

    const [updated] = await prisma.$transaction([
      prisma.benchmarkRun.update({
        where: { id },
        data: { status: "CANCELLED", finishedAt: new Date() },
      }),
      prisma.agentRun.updateMany({
        where: { benchmarkRunId: id, status: { in: ["PENDING", "RUNNING"] } },
        data: { status: "CANCELLED", finishedAt: new Date() },
      }),
    ]);

    return json({ run: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
