import { describe, expect, it } from "vitest";
import { buildExecutionPlan, type BenchmarkTaskDefinition } from "./run";

function task(key: string, baseRef: string | null = null): BenchmarkTaskDefinition {
  return {
    key,
    name: key,
    category: "DEBUGGING",
    timeoutSeconds: 600,
    weight: 10,
    baseRef,
    prompt: { slug: key, version: 1, content: "" },
  };
}

describe("buildExecutionPlan", () => {
  it("creates the full task x agent x repetition matrix", () => {
    const plan = buildExecutionPlan({
      tasks: [task("debug"), task("ui")],
      agentSlugs: ["claude-code", "codex"],
      defaultBaseRef: "snapshot/base",
      repetitions: 2,
      runId: "run-1",
    });

    expect(plan).toHaveLength(8);
    expect(plan[0]).toMatchObject({
      taskKey: "debug",
      agentSlug: "claude-code",
      repetitionIndex: 0,
      baseRef: "snapshot/base",
      workspaceKey: "run-1/claude-code/debug/r0",
      timeoutMs: 600_000,
    });
  });

  it("prefers the task-specific base ref, which is how bug and review snapshots are pinned", () => {
    const plan = buildExecutionPlan({
      tasks: [task("debugging", "snapshot/bug-timezone")],
      agentSlugs: ["codex"],
      defaultBaseRef: "snapshot/base",
      repetitions: 1,
      runId: "run-2",
    });
    expect(plan[0]?.baseRef).toBe("snapshot/bug-timezone");
  });

  it("rejects empty matrices and invalid repetitions", () => {
    expect(() =>
      buildExecutionPlan({
        tasks: [],
        agentSlugs: ["codex"],
        defaultBaseRef: "x",
        repetitions: 1,
        runId: "r",
      }),
    ).toThrow(/at least one task/);
    expect(() =>
      buildExecutionPlan({
        tasks: [task("ui")],
        agentSlugs: ["codex"],
        defaultBaseRef: "x",
        repetitions: 0,
        runId: "r",
      }),
    ).toThrow(/repetitions/);
  });
});
