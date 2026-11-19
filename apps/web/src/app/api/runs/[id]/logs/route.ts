import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/prisma";
import { errorResponse, HttpError, json } from "@/server/http";
import { resolveArtifactPath } from "@/server/artifacts";

const STREAMS = ["stdout", "stderr", "diff"] as const;
type StreamName = (typeof STREAMS)[number];

function isStream(value: string | null): value is StreamName {
  return value !== null && (STREAMS as readonly string[]).includes(value);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const agentRunId = url.searchParams.get("agentRunId");
    const stream = url.searchParams.get("stream");

    const prisma = getPrisma();
    const run = await prisma.benchmarkRun.findUnique({ where: { id } });
    if (!run) {
      throw new HttpError(404, "评测批次不存在");
    }

    if (!agentRunId) {
      const agentRuns = await prisma.agentRun.findMany({
        where: { benchmarkRunId: id },
        select: {
          id: true,
          status: true,
          stdoutPath: true,
          stderrPath: true,
          diffPath: true,
          agent: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return json({ agentRuns });
    }

    const agentRun = await prisma.agentRun.findFirst({
      where: { id: agentRunId, benchmarkRunId: id },
      select: {
        id: true,
        status: true,
        stdoutPath: true,
        stderrPath: true,
        diffPath: true,
        agent: { select: { name: true } },
      },
    });
    if (!agentRun) {
      throw new HttpError(404, "Agent 运行记录不存在");
    }

    if (!stream) {
      return json({ agentRun });
    }
    if (!isStream(stream)) {
      throw new HttpError(400, `stream 必须是 ${STREAMS.join("、")} 之一`);
    }

    const filePath =
      stream === "stdout"
        ? agentRun.stdoutPath
        : stream === "stderr"
          ? agentRun.stderrPath
          : agentRun.diffPath;

    if (!filePath) {
      throw new HttpError(404, `该运行没有 ${stream} 产物`);
    }

    const content = await readFile(resolveArtifactPath(filePath), "utf8");
    return new NextResponse(content, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
