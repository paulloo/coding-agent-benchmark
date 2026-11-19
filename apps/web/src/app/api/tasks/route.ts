import { getPrisma } from "@/server/prisma";
import { errorResponse, json, readJsonBody } from "@/server/http";
import { createTaskSchema } from "@/server/validation";

export async function GET() {
  try {
    const tasks = await getPrisma().benchmarkTask.findMany({
      orderBy: [{ weight: "desc" }, { key: "asc" }],
      include: { promptVersion: { include: { prompt: true } } },
    });
    return json({ tasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createTaskSchema.parse(await readJsonBody(request));
    const task = await getPrisma().benchmarkTask.create({
      data: input,
      include: { promptVersion: { include: { prompt: true } } },
    });
    return json({ task }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
