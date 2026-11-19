import type { ParsedUsage } from "./cli-adapter";

interface JsonRecord {
  [key: string]: unknown;
}

function parseJsonLines(stdout: string): JsonRecord[] {
  const records: JsonRecord[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const value = JSON.parse(trimmed) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        records.push(value as JsonRecord);
      }
    } catch {
      // CLI progress output is not guaranteed to be JSON on every line.
    }
  }
  return records;
}

function numberAt(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Claude Code with --output-format stream-json emits a final `result` event
 * that carries usage and total_cost_usd. Earlier assistant events are ignored.
 */
export function parseClaudeUsage(stdout: string): ParsedUsage {
  const records = parseJsonLines(stdout);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record || record.type !== "result") {
      continue;
    }
    const usage = record.usage;
    if (!usage || typeof usage !== "object") {
      continue;
    }
    const usageRecord = usage as JsonRecord;
    const inputTokens = numberAt(usageRecord, "input_tokens");
    const outputTokens = numberAt(usageRecord, "output_tokens");
    const cachedTokens = numberAt(usageRecord, "cache_read_input_tokens");
    const costUsd = numberAt(record, "total_cost_usd");

    if (inputTokens === undefined && outputTokens === undefined) {
      continue;
    }

    return {
      tokenUsage: {
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        ...(cachedTokens !== undefined ? { cachedTokens } : {}),
      },
      ...(costUsd !== undefined ? { costUsd } : {}),
    };
  }
  return { reason: "Claude Code did not emit a result event with usage data" };
}

/**
 * Codex CLI --json emits a turn.completed event containing usage counters.
 * It does not report monetary cost, so cost stays unavailable.
 */
export function parseCodexUsage(stdout: string): ParsedUsage {
  const records = parseJsonLines(stdout);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) {
      continue;
    }
    const usage = record.usage;
    if (!usage || typeof usage !== "object") {
      continue;
    }
    const usageRecord = usage as JsonRecord;
    const inputTokens = numberAt(usageRecord, "input_tokens");
    const outputTokens = numberAt(usageRecord, "output_tokens");
    const cachedTokens = numberAt(usageRecord, "cached_input_tokens");
    if (inputTokens === undefined && outputTokens === undefined) {
      continue;
    }
    return {
      tokenUsage: {
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        ...(cachedTokens !== undefined ? { cachedTokens } : {}),
      },
      reason: "Codex CLI does not report monetary cost",
    };
  }
  return { reason: "Codex CLI did not emit usage counters" };
}

/**
 * OpenCode's run output shape differs between versions. A JSON document is
 * parsed when present; otherwise usage is reported as unavailable.
 */
export function parseOpencodeUsage(stdout: string): ParsedUsage {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { reason: "OpenCode produced no machine-readable usage data" };
  }

  let document: unknown;
  try {
    document = JSON.parse(trimmed);
  } catch {
    return { reason: "OpenCode output is not JSON; token usage unavailable" };
  }

  if (!document || typeof document !== "object") {
    return { reason: "OpenCode output is not a JSON object" };
  }

  const record = document as JsonRecord;
  const usageCandidate = record.usage ?? record.tokens;
  if (!usageCandidate || typeof usageCandidate !== "object") {
    return { reason: "OpenCode output has no usage object" };
  }

  const usageRecord = usageCandidate as JsonRecord;
  const inputTokens = numberAt(usageRecord, "input") ?? numberAt(usageRecord, "inputTokens");
  const outputTokens = numberAt(usageRecord, "output") ?? numberAt(usageRecord, "outputTokens");
  const cachedTokens = numberAt(usageRecord, "cache") ?? numberAt(usageRecord, "cachedTokens");

  if (inputTokens === undefined && outputTokens === undefined) {
    return { reason: "OpenCode usage object has no token counters" };
  }

  return {
    tokenUsage: {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    },
    reason: "OpenCode does not report monetary cost",
  };
}
