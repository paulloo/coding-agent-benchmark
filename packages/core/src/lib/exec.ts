import { spawn, type ChildProcess } from "node:child_process";

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

export interface ExecResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
  truncated: boolean;
}

const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

class OutputBuffer {
  private readonly chunks: string[] = [];
  private size = 0;
  truncated = false;

  constructor(private readonly limit: number) {}

  push(chunk: string): void {
    if (this.size >= this.limit) {
      this.truncated = true;
      return;
    }
    const remaining = this.limit - this.size;
    const value = chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
    if (value.length < chunk.length) {
      this.truncated = true;
    }
    this.chunks.push(value);
    this.size += value.length;
  }

  toString(): string {
    return this.chunks.join("") + (this.truncated ? "\n[output truncated]\n" : "");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Terminates a process and all of its children. On POSIX the child is spawned
 * in its own process group, so the whole group can be signalled. Windows uses
 * taskkill /T because process groups are not reliable for CLI wrappers.
 */
export async function killProcessTree(pid: number | undefined, graceMs = 2000): Promise<void> {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }
  await delay(graceMs);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The process group already exited.
  }
}

/**
 * Runs a command without a shell, captures bounded stdout/stderr and enforces
 * a hard timeout by killing the whole process tree.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const startedAt = Date.now();
  const limit = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const stdout = new OutputBuffer(limit);
  const stderr = new OutputBuffer(limit);

  return new Promise<ExecResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let timer: NodeJS.Timeout | undefined;

    const child: ChildProcess = spawn(command, [...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env } as NodeJS.ProcessEnv,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (exitCode: number | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      options.signal?.removeEventListener("abort", onAbort);
      resolve({
        command,
        args: [...args],
        exitCode,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        timedOut,
        cancelled,
        durationMs: Date.now() - startedAt,
        truncated: stdout.truncated || stderr.truncated,
      });
    };

    const terminate = (): void => {
      void killProcessTree(child.pid);
    };

    function onAbort(): void {
      cancelled = true;
      terminate();
    }

    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk.toString("utf8")));

    child.on("error", (error: Error) => {
      stderr.push(`\n[spawn error] ${error.message}\n`);
      finish(null);
    });

    child.on("close", (code) => finish(code));

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        terminate();
      }, options.timeoutMs);
    }

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    }
  });
}

export class CommandError extends Error {
  constructor(
    message: string,
    readonly result: ExecResult,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export function assertCommandSucceeded(result: ExecResult, context: string): void {
  if (result.exitCode !== 0) {
    const reason = result.timedOut
      ? "timed out"
      : result.cancelled
        ? "cancelled"
        : `exited with code ${result.exitCode}`;
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new CommandError(
      `${context} failed: ${reason}${detail ? `\n${detail.slice(0, 4000)}` : ""}`,
      result,
    );
  }
}
