import { describe, expect, it } from "vitest";
import { buildClaudeArgs } from "./claude-code";
import { buildCodexArgs } from "./codex";
import { buildOpencodeArgs } from "./opencode";
import { ADAPTER_IDS, createAdapter } from "./registry";

const baseInput = {
  runId: "run-1",
  prompt: "Fix the failing test",
  workingDirectory: "C:\\workspace",
  timeoutMs: 60_000,
};

describe("adapter registry", () => {
  it("exposes the first wave of adapters", () => {
    expect(ADAPTER_IDS).toEqual(["claude-code", "codex", "opencode"]);
  });

  it("rejects unknown adapters with an actionable message", () => {
    expect(() => createAdapter("cursor")).toThrow(/Unknown adapter "cursor"/);
  });

  it("creates adapters with matching ids and capabilities", () => {
    const adapter = createAdapter("codex");
    expect(adapter.id).toBe("codex");
    expect(adapter.getCapabilities().supportsHeadless).toBe(true);
    expect(adapter.getCapabilities().supportsCost).toBe(false);
  });
});

describe("argument construction", () => {
  it("passes the prompt headlessly to Claude Code and forwards the model", () => {
    const args = buildClaudeArgs({ ...baseInput, model: "claude-sonnet-4-6" });
    expect(args).toContain("-p");
    expect(args[args.indexOf("-p") + 1]).toBe(baseInput.prompt);
    expect(args).toContain("--output-format");
    expect(args[args.indexOf("--model") + 1]).toBe("claude-sonnet-4-6");
  });

  it("runs Codex in exec mode with json output", () => {
    const args = buildCodexArgs(baseInput);
    expect(args.slice(0, 3)).toEqual(["exec", "--json", "--full-auto"]);
    expect(args.at(-1)).toBe(baseInput.prompt);
  });

  it("passes the prompt as the last OpenCode argument", () => {
    const args = buildOpencodeArgs({ ...baseInput, model: "anthropic/claude-sonnet-4-6" });
    expect(args[0]).toBe("run");
    expect(args.at(-1)).toBe(baseInput.prompt);
  });
});
