import {
  runProcess,
  type AgentAdapter,
  type AgentAvailability,
  type AgentCapabilities,
  type AgentExecuteInput,
  type AgentRunResult,
  type AgentTokenUsage,
} from "@cab/core";
import { ProcessRegistry } from "./process-registry";

export interface ParsedUsage {
  tokenUsage?: AgentTokenUsage;
  costUsd?: number;
  reason?: string;
}

export interface CliAdapterConfig {
  id: string;
  name: string;
  vendor: string;
  /** Executable name or absolute path. */
  command: string;
  version: string;
  versionArgs: readonly string[];
  capabilities: AgentCapabilities;
  buildArgs(input: AgentExecuteInput): string[];
  parseUsage(stdout: string): ParsedUsage;
  /** Environment merged into every execution. Secrets must not be added here. */
  environment?: Record<string, string>;
}

/**
 * Shared implementation for agents that are driven through a headless CLI.
 * Anything CLI-specific lives in buildArgs / parseUsage.
 */
export class CliAgentAdapter implements AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly vendor: string;
  readonly version: string;

  private readonly registry = new ProcessRegistry();

  constructor(private readonly config: CliAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.vendor = config.vendor;
    this.version = config.version;
  }

  async checkAvailability(): Promise<AgentAvailability> {
    const result = await runProcess(this.config.command, this.config.versionArgs, {
      timeoutMs: 20_000,
      maxOutputBytes: 64 * 1024,
    });

    if (result.exitCode === 0) {
      const output = (result.stdout || result.stderr).trim();
      const firstLine = output.split(/\r?\n/)[0] ?? "";
      return {
        available: true,
        command: this.config.command,
        ...(firstLine ? { version: firstLine } : {}),
        checkedAt: new Date(),
      };
    }

    return {
      available: false,
      command: this.config.command,
      error:
        result.exitCode === null
          ? `Command "${this.config.command}" could not be started`
          : `Command exited with code ${result.exitCode}: ${(result.stderr || result.stdout).trim()}`,
      checkedAt: new Date(),
    };
  }

  getCapabilities(): AgentCapabilities {
    return { ...this.config.capabilities };
  }

  async execute(input: AgentExecuteInput): Promise<AgentRunResult> {
    const controller = this.registry.register(input.runId);

    const forwardAbort = (): void => controller.abort();
    if (input.signal) {
      if (input.signal.aborted) {
        controller.abort();
      } else {
        input.signal.addEventListener("abort", forwardAbort, { once: true });
      }
    }

    const startedAt = new Date();
    try {
      const result = await runProcess(this.config.command, this.config.buildArgs(input), {
        cwd: input.workingDirectory,
        timeoutMs: input.timeoutMs,
        env: { ...this.config.environment, ...input.environment },
        signal: controller.signal,
        maxOutputBytes: 32 * 1024 * 1024,
      });

      const parsed = this.config.parseUsage(result.stdout);
      const finishedAt = new Date();

      return {
        runId: input.runId,
        exitCode: result.exitCode,
        startedAt,
        finishedAt,
        durationMs: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        cancelled: result.cancelled,
        ...(parsed.tokenUsage ? { tokenUsage: parsed.tokenUsage } : {}),
        ...(parsed.costUsd !== undefined ? { costUsd: parsed.costUsd } : {}),
        ...(parsed.reason ? { usageUnavailableReason: parsed.reason } : {}),
      };
    } finally {
      input.signal?.removeEventListener("abort", forwardAbort);
      this.registry.release(input.runId);
    }
  }

  async cancel(runId: string): Promise<boolean> {
    return this.registry.cancel(runId);
  }
}
