import { getPrisma } from "@/server/prisma";
import { errorResponse, json, readJsonBody } from "@/server/http";
import { createAgentSchema } from "@/server/validation";

export async function GET() {
  try {
    const agents = await getPrisma().agent.findMany({
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    });
    return json({ agents });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createAgentSchema.parse(await readJsonBody(request));
    const agent = await getPrisma().agent.create({ data: input });
    return json({ agent }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
