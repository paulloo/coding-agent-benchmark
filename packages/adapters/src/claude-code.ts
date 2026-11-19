import type { AgentCapabilities, AgentExecuteInput } from "@cab/core";
import { CliAgentAdapter } from "./shared/cli-adapter";
import { parseClaudeUsage } from "./shared/usage";

export const CLAUDE_CODE_CAPABILITIES: AgentCapabilities = {
  supportsStreaming: true,
  supportsHeadless: true,
  supportsMcp: true,
  supportsModelSelection: true,
  supportsTokenUsage: true,
  supportsCost: true,
};

export function buildClaudeArgs(input: AgentExecuteInput): string[] {
  const args = ["-p", input.prompt, "--output-format", "stream-json", "--verbose"];

  // Headless runs cannot answer approval prompts. bypassPermissions is only
  // acceptable inside the container isolation mode enforced by the runner.
  const permissionMode = process.env.CAB_CLAUDE_PERMISSION_MODE ?? "bypassPermissions";
  if (permissionMode) {
    args.push("--permission-mode", permissionMode);
  }
  if (input.model) {
    args.push("--model", input.model);
  }
  return args;
}

export function createClaudeCodeAdapter(): CliAgentAdapter {
  return new CliAgentAdapter({
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    command: process.env.CAB_CLAUDE_BIN ?? "claude",
    version: "1.0.0",
    versionArgs: ["--version"],
    capabilities: CLAUDE_CODE_CAPABILITIES,
    buildArgs: buildClaudeArgs,
    parseUsage: parseClaudeUsage,
  });
}
