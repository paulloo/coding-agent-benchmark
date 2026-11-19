import { getPrisma } from "@/server/prisma";
import { buildLeaderboard } from "@/server/leaderboard";
import { errorResponse, HttpError, json } from "@/server/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const entries = await buildLeaderboard(getPrisma());
    const entry = entries.find((candidate) => candidate.agentId === agentId);
    if (!entry) {
      throw new HttpError(404, "该 Agent 还没有评分数据");
    }
    return json({ entry });
  } catch (error) {
    return errorResponse(error);
  }
}
