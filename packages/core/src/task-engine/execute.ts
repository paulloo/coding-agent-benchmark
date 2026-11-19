import path from "node:path";
import type { AgentAdapter, AgentRunResult } from "../types/agent";
import type { ArtifactType } from "../types/evaluation";
import { ensureDir, writeArtifact, type WrittenArtifact } from "../lib/fs";
import { collectSecretValues, redactText } from "../lib/redact";
import {
  createWorkspace,
  finalizeWorkspace,
  removeWorkspace,
  type WorkspaceHandle,
} from "../workspace/git";

export interface ExecuteAgentTaskInput {
  agentRunId: string;
  adapter: AgentAdapter;
  prompt: string;
  repoPath: string;
  workspaceRoot: string;
  artifactRoot: string;
  workspaceKey: string;
  baseRef: string;
  timeoutMs: number;
  model?: string;
  environment?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ArtifactRecord {
  type: ArtifactType;
  path: string;
  checksum: string;
  size: number;
}

export interface ExecuteAgentTaskResult {
  workspace: WorkspaceHandle;
  result: AgentRunResult;
  finalCommit: string;
  diffPath: string;
  diffStats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  artifacts: ArtifactRecord[];
}

/**
 * Runs one agent against one task in an isolated git worktree and persists the
 * raw output plus the resulting diff. Artifact paths are returned so the
 * caller can decide whether to keep or archive the worktree.
 */
export async function executeAgentTask(input: ExecuteAgentTaskInput): Promise<ExecuteAgentTaskResult> {
  const workspace = await createWorkspace({
    repoPath: input.repoPath,
    rootDir: input.workspaceRoot,
    workspaceKey: input.workspaceKey,
    baseRef: input.baseRef,
  });

  const artifactDirectory = path.join(input.artifactRoot, input.agentRunId);
  await ensureDir(artifactDirectory);

  const secrets = collectSecretValues({ ...process.env, ...input.environment });

  let result: AgentRunResult;
  try {
    result = await input.adapter.execute({
      runId: input.agentRunId,
      prompt: input.prompt,
      workingDirectory: workspace.path,
      timeoutMs: input.timeoutMs,
      ...(input.model ? { model: input.model } : {}),
      ...(input.environment ? { environment: input.environment } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } catch (error) {
    await removeWorkspace(workspace).catch(() => undefined);
    throw error;
  }

  const stdoutArtifact = await writeArtifact(
    artifactDirectory,
    "stdout.log",
    redactText(result.stdout, secrets),
  );
  const stderrArtifact = await writeArtifact(
    artifactDirectory,
    "stderr.log",
    redactText(result.stderr, secrets),
  );

  const finalState = await finalizeWorkspace(workspace);
  const diffArtifact = await writeArtifact(
    artifactDirectory,
    "changes.diff",
    redactText(finalState.diff, secrets),
  );

  return {
    workspace,
    result,
    finalCommit: finalState.finalCommit,
    diffPath: diffArtifact.path,
    diffStats: {
      filesChanged: finalState.filesChanged,
      insertions: finalState.insertions,
      deletions: finalState.deletions,
    },
    artifacts: [
      { type: "STDOUT", ...stdoutArtifact },
      { type: "STDERR", ...stderrArtifact },
      { type: "DIFF", ...diffArtifact },
    ],
  };
}

export function artifactFromPath(type: ArtifactType, artifact: WrittenArtifact): ArtifactRecord {
  return { type, ...artifact };
}
