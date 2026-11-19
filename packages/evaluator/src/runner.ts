import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  collectSecretValues,
  redactText,
  runProcess,
  writeArtifact,
  type EvaluationDetails,
  type EvaluationResult,
  type EvaluationReport,
} from "@cab/core";
import { createDefaultChecks, type CheckContext, type EvaluationCheck } from "./checks";

export interface RunEvaluationOptions {
  agentRunId: string;
  workspacePath: string;
  artifactDir: string;
  /** Which checks the task requires. Empty means manual review only. */
  checkKeys: readonly string[];
  diffPath?: string;
  checks?: readonly EvaluationCheck[];
  environment?: Record<string, string>;
}

interface ParsedTestCounts {
  total: number;
  passed: number;
  failed: number;
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function interpretTestReport(
  checkKey: string,
  context: CheckContext,
): Promise<{ counts?: ParsedTestCounts; notes: string[] }> {
  const notes: string[] = [];

  if (checkKey === "unit") {
    const report = await readJson<{
      numTotalTests?: number;
      numPassedTests?: number;
      numFailedTests?: number;
    }>(path.join(context.artifactDir, "vitest.json"));
    if (!report || typeof report.numTotalTests !== "number") {
      notes.push("未找到 Vitest JSON 报告，仅使用退出码判定");
      return { notes };
    }
    return {
      counts: {
        total: report.numTotalTests,
        passed: report.numPassedTests ?? 0,
        failed: report.numFailedTests ?? 0,
      },
      notes,
    };
  }

  if (checkKey === "e2e") {
    const report = await readJson<{
      stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
    }>(path.join(context.artifactDir, "playwright.json"));
    const stats = report?.stats;
    if (!stats) {
      notes.push("未找到 Playwright JSON 报告，仅使用退出码判定");
      return { notes };
    }
    const expected = stats.expected ?? 0;
    const unexpected = stats.unexpected ?? 0;
    const skipped = stats.skipped ?? 0;
    return {
      counts: { total: expected + unexpected + skipped, passed: expected, failed: unexpected },
      notes,
    };
  }

  return { notes };
}

function ratioScore(counts: ParsedTestCounts): number | null {
  if (counts.total <= 0) {
    return null;
  }
  return Math.round((counts.passed / counts.total) * 10000) / 100;
}

export async function runEvaluation(options: RunEvaluationOptions): Promise<EvaluationReport> {
  const checks = options.checks ?? createDefaultChecks();
  const byKey = new Map(checks.map((check) => [check.key, check]));
  const selected: EvaluationCheck[] = [];

  for (const key of options.checkKeys) {
    const check = byKey.get(key);
    if (!check) {
      throw new Error(`Unknown evaluation check "${key}". Available: ${[...byKey.keys()].join(", ")}`);
    }
    selected.push(check);
  }

  const startedAt = new Date();
  const context: CheckContext = {
    workspacePath: options.workspacePath,
    artifactDir: options.artifactDir,
    ...(options.diffPath ? { diffPath: options.diffPath } : {}),
  };
  const secrets = collectSecretValues({ ...process.env, ...options.environment });
  const results: EvaluationResult[] = [];

  for (const check of selected) {
    const checkStartedAt = Date.now();

    if (check.run) {
      const outcome = await check.run(context);
      results.push({
        checkKey: check.key,
        category: check.category,
        passed: outcome.passed,
        score: outcome.score,
        details: outcome.details,
        durationMs: Date.now() - checkStartedAt,
      });
      continue;
    }

    if (!check.buildCommand) {
      throw new Error(`Check "${check.key}" has neither a command nor a builtin implementation`);
    }

    const command = check.buildCommand(context);
    const [executable, ...args] = command;
    if (!executable) {
      throw new Error(`Check "${check.key}" produced an empty command`);
    }

    const execution = await runProcess(executable, args, {
      cwd: options.workspacePath,
      timeoutMs: check.timeoutMs,
      env: check.buildEnv ? check.buildEnv(context) : undefined,
      maxOutputBytes: 4 * 1024 * 1024,
    });

    const log = await writeArtifact(
      path.join(options.artifactDir, "checks"),
      `${check.key}.log`,
      redactText(
        [
          `$ ${command.join(" ")}`,
          `exitCode: ${execution.exitCode}`,
          `timedOut: ${execution.timedOut}`,
          "",
          execution.stdout,
          execution.stderr,
        ].join("\n"),
        secrets,
      ),
    );

    const interpreted = await interpretTestReport(check.key, context);
    const counts = interpreted.counts;
    const passed = execution.exitCode === 0;

    const details: EvaluationDetails = {
      command: command.join(" "),
      exitCode: execution.exitCode,
      summary: passed ? "通过" : execution.timedOut ? "超时" : "失败",
      timedOut: execution.timedOut,
      truncatedOutput: execution.stdout.slice(-4000) || execution.stderr.slice(-4000),
      notes: interpreted.notes,
      ...(counts
        ? {
            metrics: {
              total: counts.total,
              passed: counts.passed,
              failed: counts.failed,
            },
          }
        : {}),
    };

    results.push({
      checkKey: check.key,
      category: check.category,
      passed,
      score: counts ? ratioScore(counts) : passed ? 100 : 0,
      details,
      rawLogPath: log.path,
      durationMs: execution.durationMs,
    });
  }

  return {
    agentRunId: options.agentRunId,
    workspacePath: options.workspacePath,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    results,
  };
}
