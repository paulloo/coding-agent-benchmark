import { rm } from "node:fs/promises";
import path from "node:path";
import { assertCommandSucceeded, runProcess, type ExecResult } from "../lib/exec";
import { ensureDir, toPathSegment } from "../lib/fs";

const GIT_IDENTITY = {
  name: "Coding Agent Benchmark",
  email: "benchmark@localhost",
} as const;

export interface CreateWorkspaceInput {
  repoPath: string;
  rootDir: string;
  /** Unique key such as runId/agent/task/r0. Also used for the branch name. */
  workspaceKey: string;
  baseRef: string;
}

export interface WorkspaceHandle {
  workspaceKey: string;
  repoPath: string;
  path: string;
  branch: string;
  baseCommit: string;
  createdAt: Date;
}

export interface WorkspaceFinalState {
  finalCommit: string;
  diff: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  hadUncommittedChanges: boolean;
}

async function runGit(args: readonly string[], cwd: string, timeoutMs = 120_000): Promise<ExecResult> {
  return runProcess("git", args, {
    cwd,
    timeoutMs,
    env: {
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "echo",
      LC_ALL: "C",
    },
  });
}

async function git(args: readonly string[], cwd: string, context: string): Promise<string> {
  const result = await runGit(args, cwd);
  assertCommandSucceeded(result, context);
  return result.stdout.trim();
}

export async function isGitRepository(repoPath: string): Promise<boolean> {
  const result = await runGit(["rev-parse", "--git-dir"], repoPath, 15_000);
  return result.exitCode === 0;
}

export async function resolveCommit(repoPath: string, ref: string): Promise<string> {
  return git(["rev-parse", "--verify", `${ref}^{commit}`], repoPath, `resolve ref ${ref}`);
}

export async function getHeadCommit(workspacePath: string): Promise<string> {
  return git(["rev-parse", "HEAD"], workspacePath, "read HEAD");
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceHandle> {
  const repoPath = path.resolve(input.repoPath);
  const rootDir = path.resolve(input.rootDir);
  const workspacePath = path.resolve(rootDir, input.workspaceKey);
  const rootPrefix = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;

  if (!workspacePath.startsWith(rootPrefix)) {
    throw new Error(`Workspace path escapes the workspace root: ${workspacePath}`);
  }

  if (!(await isGitRepository(repoPath))) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  const baseCommit = await resolveCommit(repoPath, input.baseRef);
  const branch = `benchmark/${toPathSegment(input.workspaceKey)}`;

  await ensureDir(rootDir);

  const add = await runGit(
    [
      "-c",
      "core.autocrlf=false",
      "-c",
      "core.eol=lf",
      "-c",
      "core.safecrlf=false",
      "worktree",
      "add",
      "-b",
      branch,
      workspacePath,
      baseCommit,
    ],
    repoPath,
    180_000,
  );
  assertCommandSucceeded(add, `create worktree for ${input.workspaceKey}`);

  // Agents must be able to commit inside the worktree even when the host has
  // no global git identity. Line endings are pinned so diffs are byte-stable.
  const settings: Array<readonly [string, string]> = [
    ["user.name", GIT_IDENTITY.name],
    ["user.email", GIT_IDENTITY.email],
    ["core.autocrlf", "false"],
    ["core.safecrlf", "false"],
  ];
  for (const [key, value] of settings) {
    const config = await runGit(["config", key, value], workspacePath, 30_000);
    assertCommandSucceeded(config, `configure ${key} in worktree`);
  }

  return {
    workspaceKey: input.workspaceKey,
    repoPath,
    path: workspacePath,
    branch,
    baseCommit,
    createdAt: new Date(),
  };
}

function parseShortStat(summary: string): { filesChanged: number; insertions: number; deletions: number } {
  const files = /(\d+) files? changed/.exec(summary);
  const insertions = /(\d+) insertions?\(\+\)/.exec(summary);
  const deletions = /(\d+) deletions?\(-\)/.exec(summary);
  return {
    filesChanged: files ? Number(files[1]) : 0,
    insertions: insertions ? Number(insertions[1]) : 0,
    deletions: deletions ? Number(deletions[1]) : 0,
  };
}

/**
 * Commits anything the agent left uncommitted, then snapshots the diff against
 * the base commit. The commit is required so a result can always be traced to
 * an exact tree, even if the agent never ran git itself.
 */
export async function finalizeWorkspace(handle: WorkspaceHandle): Promise<WorkspaceFinalState> {
  const status = await git(["status", "--porcelain"], handle.path, "read worktree status");
  const hadUncommittedChanges = status.length > 0;

  if (hadUncommittedChanges) {
    await git(["add", "-A"], handle.path, "stage agent changes");
    await git(
      [
        "-c",
        `user.name=${GIT_IDENTITY.name}`,
        "-c",
        `user.email=${GIT_IDENTITY.email}`,
        "commit",
        "--no-verify",
        "-m",
        "chore(benchmark): snapshot agent changes",
      ],
      handle.path,
      "commit agent changes",
    );
  }

  const finalCommit = await getHeadCommit(handle.path);
  const diff = await git(
    ["diff", "--binary", "--no-ext-diff", handle.baseCommit, finalCommit],
    handle.path,
    "collect agent diff",
  );
  const shortStat = await git(
    ["diff", "--shortstat", handle.baseCommit, finalCommit],
    handle.path,
    "collect diff statistics",
  );

  return {
    finalCommit,
    diff,
    hadUncommittedChanges,
    ...parseShortStat(shortStat),
  };
}

export async function removeWorkspace(handle: WorkspaceHandle): Promise<void> {
  const remove = await runGit(["worktree", "remove", "--force", handle.path], handle.repoPath, 120_000);
  if (remove.exitCode !== 0) {
    await rm(handle.path, { recursive: true, force: true });
  }
  await runGit(["worktree", "prune"], handle.repoPath, 60_000);
}

export async function listWorktrees(repoPath: string): Promise<string[]> {
  const output = await git(["worktree", "list", "--porcelain"], repoPath, "list worktrees");
  return output
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}
