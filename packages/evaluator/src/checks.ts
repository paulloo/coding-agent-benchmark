import path from "node:path";
import type { EvaluationCategory, EvaluationDetails } from "@cab/core";
import { scanSecrets } from "./security-scan";

export interface CheckContext {
  workspacePath: string;
  artifactDir: string;
  diffPath?: string;
}

export interface BuiltinOutcome {
  passed: boolean;
  score: number | null;
  details: EvaluationDetails;
}

export interface EvaluationCheck {
  key: string;
  category: EvaluationCategory;
  description: string;
  required: boolean;
  timeoutMs: number;
  /** Command based check. Mutually exclusive with run(). */
  buildCommand?: (context: CheckContext) => string[];
  buildEnv?: (context: CheckContext) => Record<string, string>;
  /** In-process check for analysis that does not spawn a command. */
  run?: (context: CheckContext) => Promise<BuiltinOutcome>;
}

export function createDefaultChecks(): EvaluationCheck[] {
  return [
    {
      key: "typecheck",
      category: "BUILD",
      description: "TypeScript 类型检查",
      required: true,
      timeoutMs: 300_000,
      buildCommand: () => ["pnpm", "exec", "tsc", "--noEmit"],
    },
    {
      key: "lint",
      category: "QUALITY",
      description: "ESLint 静态检查",
      required: false,
      timeoutMs: 180_000,
      buildCommand: () => ["pnpm", "exec", "eslint", ".", "--max-warnings=0"],
    },
    {
      key: "unit",
      category: "TEST",
      description: "Vitest 单元与集成测试",
      required: true,
      timeoutMs: 600_000,
      buildCommand: (context) => [
        "pnpm",
        "exec",
        "vitest",
        "run",
        "--reporter=json",
        `--outputFile=${path.join(context.artifactDir, "vitest.json")}`,
      ],
    },
    {
      key: "e2e",
      category: "TEST",
      description: "Playwright 端到端测试",
      required: false,
      timeoutMs: 900_000,
      buildCommand: () => ["pnpm", "exec", "playwright", "test", "--reporter=json"],
      buildEnv: (context) => ({
        CI: "1",
        PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(context.artifactDir, "playwright.json"),
      }),
    },
    {
      key: "build",
      category: "BUILD",
      description: "生产构建",
      required: true,
      timeoutMs: 900_000,
      buildCommand: () => ["pnpm", "build"],
    },
    {
      key: "security",
      category: "SECURITY",
      description: "变更中的凭据与密钥扫描",
      required: true,
      timeoutMs: 120_000,
      run: async (context) => {
        const findings = await scanSecrets(context);
        const score = findings.length === 0 ? 100 : Math.max(0, 100 - findings.length * 25);
        return {
          passed: findings.length === 0,
          score,
          details: {
            summary:
              findings.length === 0
                ? "未发现硬编码凭据"
                : `发现 ${findings.length} 处疑似凭据`,
            notes: findings.map((finding) => `${finding.file}:${finding.line} ${finding.rule}`),
            metrics: { findings: findings.length },
            findings,
          },
        };
      },
    },
  ];
}

export const DEFAULT_CHECK_KEYS = createDefaultChecks().map((check) => check.key);
