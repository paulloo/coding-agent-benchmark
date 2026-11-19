import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json, readJsonBody } from "@/server/http";
import { updateTaskSchema } from "@/server/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await getPrisma().benchmarkTask.findUnique({
      where: { id },
      include: { promptVersion: { include: { prompt: true } } },
    });
    if (!task) {
      throw new HttpError(404, "任务不存在");
    }
    return json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = updateTaskSchema.parse(await readJsonBody(request));
    const task = await getPrisma().benchmarkTask.update({
      where: { id },
      data: input,
      include: { promptVersion: { include: { prompt: true } } },
    });
    return json({ task });
  } catch (error) {
    return errorResponse(error);
  }
}
