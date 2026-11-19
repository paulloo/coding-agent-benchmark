import type { AgentAdapter } from "@cab/core";
import { createClaudeCodeAdapter } from "./claude-code";
import { createCodexAdapter } from "./codex";
import { createOpencodeAdapter } from "./opencode";

export const ADAPTER_IDS = ["claude-code", "codex", "opencode"] as const;
export type AdapterId = (typeof ADAPTER_IDS)[number];

const FACTORIES: Record<AdapterId, () => AgentAdapter> = {
  "claude-code": createClaudeCodeAdapter,
  codex: createCodexAdapter,
  opencode: createOpencodeAdapter,
};

export function isAdapterId(value: string): value is AdapterId {
  return (ADAPTER_IDS as readonly string[]).includes(value);
}

export function createAdapter(id: string): AgentAdapter {
  if (!isAdapterId(id)) {
    throw new Error(`Unknown adapter "${id}". Available adapters: ${ADAPTER_IDS.join(", ")}`);
  }
  return FACTORIES[id]();
}

export function createAllAdapters(): AgentAdapter[] {
  return ADAPTER_IDS.map((id) => FACTORIES[id]());
}
