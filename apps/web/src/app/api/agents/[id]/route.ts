import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json, readJsonBody } from "@/server/http";
import { updateAgentSchema } from "@/server/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await getPrisma().agent.findUnique({ where: { id } });
    if (!agent) {
      throw new HttpError(404, "Agent 不存在");
    }
    return json({ agent });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = updateAgentSchema.parse(await readJsonBody(request));
    const agent = await getPrisma().agent.update({ where: { id }, data: input });
    return json({ agent });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getPrisma().agent.delete({ where: { id } });
    return json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
