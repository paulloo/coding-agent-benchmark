import { describe, expect, it } from "vitest";
import { collectSecretValues, redactEnvironment, redactText } from "./redact";

describe("redaction", () => {
  it("masks secret-looking environment values but keeps the rest", () => {
    const result = redactEnvironment({
      ANTHROPIC_API_KEY: "sk-ant-secret",
      DATABASE_URL: "postgresql://cab:pass@localhost:5433/db",
      HOME: "/home/user",
      EMPTY: undefined,
    });

    expect(result.ANTHROPIC_API_KEY).toBe("[REDACTED]");
    expect(result.HOME).toBe("/home/user");
    expect(result.EMPTY).toBeUndefined();
    expect(result.DATABASE_URL).toContain("postgresql://cab:pass@");
  });

  it("removes known secret values from logs", () => {
    const secrets = collectSecretValues({ OPENAI_API_KEY: "sk-live-123456" });
    const output = redactText("key=sk-live-123456 done", secrets);
    expect(output).toBe("key=[REDACTED] done");
  });

  it("strips credentials embedded in connection strings", () => {
    const output = redactText("connecting to postgresql://user:hunter2@db:5432/app");
    expect(output).toBe("connecting to postgresql://user:[REDACTED]@db:5432/app");
  });
});
