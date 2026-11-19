import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CheckContext } from "./checks";

export interface SecretFinding {
  file: string;
  line: number;
  rule: string;
}

interface Rule {
  id: string;
  pattern: RegExp;
  /** Rules only apply to lines the agent added, never to unchanged context. */
  addedLinesOnly?: boolean;
}

const RULES: Rule[] = [
  { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { id: "postgres-credentials", pattern: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]{3,}@/i },
  { id: "generic-api-key", pattern: /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i },
];

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".env",
  ".yml",
  ".yaml",
  ".sql",
]);

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
]);

const MAX_FILE_BYTES = 256 * 1024;

function scanText(file: string, text: string, addedLinesOnly: boolean): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (addedLinesOnly && !line.startsWith("+")) {
      return;
    }
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({ file, line: index + 1, rule: rule.id });
      }
    }
  });
  return findings;
}

async function walk(directory: string, files: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        await walk(fullPath, files);
      }
      continue;
    }
    const extension = path.extname(entry.name);
    const isEnvFile = entry.name.startsWith(".env");
    if (!SOURCE_EXTENSIONS.has(extension) && !isEnvFile) {
      continue;
    }
    const info = await stat(fullPath);
    if (info.size <= MAX_FILE_BYTES) {
      files.push(fullPath);
    }
  }
}

/**
 * Scans the agent diff when available, otherwise the workspace source tree.
 * Findings are reported with file and line so a reviewer can verify them.
 */
export async function scanSecrets(context: CheckContext): Promise<SecretFinding[]> {
  if (context.diffPath) {
    try {
      const diff = await readFile(context.diffPath, "utf8");
      return scanText(context.diffPath, diff, true);
    } catch {
      // Fall through to a workspace scan when the diff artifact is missing.
    }
  }

  const files: string[] = [];
  await walk(context.workspacePath, files);

  const findings: SecretFinding[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    findings.push(...scanText(path.relative(context.workspacePath, file), text, false));
  }
  return findings;
}
