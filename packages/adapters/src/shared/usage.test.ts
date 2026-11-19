import { describe, expect, it } from "vitest";
import { parseClaudeUsage, parseCodexUsage, parseOpencodeUsage } from "./usage";

describe("parseClaudeUsage", () => {
  it("reads usage and cost from the last result event", () => {
    const stdout = [
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({
        type: "assistant",
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
      JSON.stringify({
        type: "result",
        total_cost_usd: 0.0421,
        usage: {
          input_tokens: 1200,
          output_tokens: 340,
          cache_read_input_tokens: 800,
        },
      }),
    ].join("\n");

    expect(parseClaudeUsage(stdout)).toEqual({
      tokenUsage: { inputTokens: 1200, outputTokens: 340, cachedTokens: 800 },
      costUsd: 0.0421,
    });
  });

  it("reports unavailability instead of estimating", () => {
    const parsed = parseClaudeUsage("all tests passed\n");
    expect(parsed.tokenUsage).toBeUndefined();
    expect(parsed.costUsd).toBeUndefined();
    expect(parsed.reason).toContain("usage");
  });
});

describe("parseCodexUsage", () => {
  it("reads usage counters from a turn event", () => {
    const stdout = [
      '{"type":"thread.started"}',
      '{"type":"turn.completed","usage":{"input_tokens":900,"cached_input_tokens":100,"output_tokens":250}}',
    ].join("\n");

    expect(parseCodexUsage(stdout)).toEqual({
      tokenUsage: { inputTokens: 900, outputTokens: 250, cachedTokens: 100 },
      reason: "Codex CLI does not report monetary cost",
    });
  });

  it("ignores malformed jsonl lines", () => {
    const parsed = parseCodexUsage('{"type":"turn.completed"\nnot json');
    expect(parsed.tokenUsage).toBeUndefined();
    expect(parsed.reason).toBeDefined();
  });
});

describe("parseOpencodeUsage", () => {
  it("parses a json document with a tokens object", () => {
    const parsed = parseOpencodeUsage(
      JSON.stringify({ tokens: { input: 400, output: 80, cache: 20 } }),
    );
    expect(parsed.tokenUsage).toEqual({ inputTokens: 400, outputTokens: 80, cachedTokens: 20 });
  });

  it("marks plain text output as unavailable", () => {
    const parsed = parseOpencodeUsage("Done. I updated the page.");
    expect(parsed.tokenUsage).toBeUndefined();
    expect(parsed.reason).toContain("not JSON");
  });
});
