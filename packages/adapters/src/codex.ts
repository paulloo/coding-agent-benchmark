import type { AgentCapabilities, AgentExecuteInput } from "@cab/core";
import { CliAgentAdapter } from "./shared/cli-adapter";
import { parseCodexUsage } from "./shared/usage";

export const CODEX_CAPABILITIES: AgentCapabilities = {
  supportsStreaming: true,
  supportsHeadless: true,
  supportsMcp: true,
  supportsModelSelection: true,
  supportsTokenUsage: true,
  supportsCost: false,
};

export function buildCodexArgs(input: AgentExecuteInput): string[] {
  const args = ["exec", "--json", "--full-auto"];
  if (input.model) {
    args.push("--model", input.model);
  }
  args.push(input.prompt);
  return args;
}

export function createCodexAdapter(): CliAgentAdapter {
  return new CliAgentAdapter({
    id: "codex",
    name: "Codex CLI",
    vendor: "OpenAI",
    command: process.env.CAB_CODEX_BIN ?? "codex",
    version: "1.0.0",
    versionArgs: ["--version"],
    capabilities: CODEX_CAPABILITIES,
    buildArgs: buildCodexArgs,
    parseUsage: parseCodexUsage,
  });
}
