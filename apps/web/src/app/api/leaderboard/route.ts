import { getPrisma } from "@/server/prisma";
import { buildLeaderboard } from "@/server/leaderboard";
import { errorResponse, json } from "@/server/http";

export async function GET() {
  try {
    const entries = await buildLeaderboard(getPrisma());
    return json({ generatedAt: new Date().toISOString(), entries });
  } catch (error) {
    return errorResponse(error);
  }
}
