import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "参数校验失败", details: error.issues },
      { status: 400 },
    );
  }

  const code = (error as { code?: unknown }).code;
  if (code === "P2025") {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }
  if (code === "P2002") {
    return NextResponse.json({ error: "唯一约束冲突" }, { status: 409 });
  }
  if (code === "P2003") {
    return NextResponse.json({ error: "存在关联数据，操作被拒绝" }, { status: 409 });
  }

  console.error(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "服务器内部错误" },
    { status: 500 },
  );
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "请求体必须是合法 JSON");
  }
}
