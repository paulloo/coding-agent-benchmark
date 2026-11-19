import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorkspace,
  finalizeWorkspace,
  getHeadCommit,
  listWorktrees,
  removeWorkspace,
  resolveCommit,
} from "./git";

let repoPath: string;
let rootDir: string;

function git(args: string[], cwd = repoPath): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

beforeEach(async () => {
  repoPath = await mkdtemp(path.join(tmpdir(), "cab-repo-"));
  rootDir = await mkdtemp(path.join(tmpdir(), "cab-worktrees-"));

  git(["init", "-q"], repoPath);
  git(["config", "user.name", "Benchmark Fixture"]);
  git(["config", "user.email", "fixture@localhost"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "core.autocrlf", "false"]);
  await writeFile(path.join(repoPath, "README.md"), "# fixture\n");
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "initial"]);
});

afterEach(async () => {
  await rm(repoPath, { recursive: true, force: true });
  await rm(rootDir, { recursive: true, force: true });
});

describe("git workspace management", () => {
  it("creates an isolated worktree on a dedicated branch", async () => {
    const handle = await createWorkspace({
      repoPath,
      rootDir,
      workspaceKey: "run-1/claude-code/feature/r0",
      baseRef: "HEAD",
    });

    expect(handle.path.startsWith(rootDir)).toBe(true);
    expect(handle.branch).toBe("benchmark/run-1-claude-code-feature-r0");
    expect(await resolveCommit(repoPath, "HEAD")).toBe(handle.baseCommit);
    expect(await getHeadCommit(handle.path)).toBe(handle.baseCommit);
    expect((await listWorktrees(repoPath)).length).toBe(2);

    const file = path.join(handle.path, "feature.ts");
    await writeFile(file, "export const value = 42;\n");
    const content = await readFile(file, "utf8");
    expect(content).toContain("42");
  });

  it("snapshots uncommitted agent changes into a traceable commit", async () => {
    const handle = await createWorkspace({
      repoPath,
      rootDir,
      workspaceKey: "run-1/codex/ui/r0",
      baseRef: "HEAD",
    });

    await writeFile(path.join(handle.path, "dashboard.tsx"), "export const Page = () => null;\n");

    const state = await finalizeWorkspace(handle);
    expect(state.hadUncommittedChanges).toBe(true);
    expect(state.finalCommit).not.toBe(handle.baseCommit);
    expect(state.filesChanged).toBe(1);
    expect(state.diff).toContain("dashboard.tsx");
    expect(state.diff).toContain("+export const Page");

    const log = git(["log", "-1", "--pretty=%s"], handle.path);
    expect(log).toBe("chore(benchmark): snapshot agent changes");
  });

  it("does not create an empty commit when the agent changed nothing", async () => {
    const handle = await createWorkspace({
      repoPath,
      rootDir,
      workspaceKey: "run-2/opencode/understanding/r0",
      baseRef: "HEAD",
    });

    const state = await finalizeWorkspace(handle);
    expect(state.hadUncommittedChanges).toBe(false);
    expect(state.finalCommit).toBe(handle.baseCommit);
    expect(state.diff).toBe("");
    expect(state.filesChanged).toBe(0);
  });

  it("rejects workspace keys that escape the root directory", async () => {
    await expect(
      createWorkspace({
        repoPath,
        rootDir,
        workspaceKey: "../outside",
        baseRef: "HEAD",
      }),
    ).rejects.toThrow(/escapes/);
  });

  it("removes the worktree from git metadata", async () => {
    const handle = await createWorkspace({
      repoPath,
      rootDir,
      workspaceKey: "run-3/claude-code/debugging/r0",
      baseRef: "HEAD",
    });

    await removeWorkspace(handle);
    expect((await listWorktrees(repoPath)).length).toBe(1);
  });
});
