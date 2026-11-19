import type { AgentCapabilities, AgentExecuteInput } from "@cab/core";
import { CliAgentAdapter } from "./shared/cli-adapter";
import { parseOpencodeUsage } from "./shared/usage";

export const OPENCODE_CAPABILITIES: AgentCapabilities = {
  supportsStreaming: true,
  supportsHeadless: true,
  supportsMcp: true,
  supportsModelSelection: true,
  supportsTokenUsage: false,
  supportsCost: false,
};

export function buildOpencodeArgs(input: AgentExecuteInput): string[] {
  const args = ["run"];
  if (input.model) {
    args.push("--model", input.model);
  }
  if (process.env.CAB_OPENCODE_PRINT_LOGS === "1") {
    args.push("--print-logs");
  }
  args.push(input.prompt);
  return args;
}

export function createOpencodeAdapter(): CliAgentAdapter {
  return new CliAgentAdapter({
    id: "opencode",
    name: "OpenCode",
    vendor: "OpenCode",
    command: process.env.CAB_OPENCODE_BIN ?? "opencode",
    version: "1.0.0",
    versionArgs: ["--version"],
    capabilities: OPENCODE_CAPABILITIES,
    buildArgs: buildOpencodeArgs,
    parseUsage: parseOpencodeUsage,
  });
}
