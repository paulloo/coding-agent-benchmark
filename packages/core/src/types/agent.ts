export interface AgentCapabilities {
  supportsStreaming: boolean;
  supportsHeadless: boolean;
  supportsMcp: boolean;
  supportsModelSelection: boolean;
  supportsTokenUsage: boolean;
  supportsCost: boolean;
}

export interface AgentAvailability {
  available: boolean;
  command: string;
  version?: string;
  error?: string;
  checkedAt: Date;
}

export interface AgentTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}

export interface AgentExecuteInput {
  /** Stable identifier used to register the child process for cancellation. */
  runId: string;
  prompt: string;
  workingDirectory: string;
  model?: string;
  timeoutMs: number;
  environment?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  runId: string;
  exitCode: number | null;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  tokenUsage?: AgentTokenUsage;
  costUsd?: number;
  /**
   * Set when the CLI completed but produced no trustworthy token or cost
   * data. Callers must persist this as "unavailable", never estimate.
   */
  usageUnavailableReason?: string;
}

export interface AgentAdapter {
  id: string;
  name: string;
  vendor: string;
  version: string;

  checkAvailability(): Promise<AgentAvailability>;
  getCapabilities(): AgentCapabilities;
  execute(input: AgentExecuteInput): Promise<AgentRunResult>;
  cancel(runId: string): Promise<boolean>;
}
