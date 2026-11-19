import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanSecrets } from "./security-scan";

const created: string[] = [];

async function workspace(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cab-security-"));
  created.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("scanSecrets", () => {
  it("finds a committed private key and reports its location", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "src"));
    await writeFile(
      path.join(root, "src", "key.ts"),
      'export const key = "-----BEGIN PRIVATE KEY-----";\n',
    );

    const findings = await scanSecrets({ workspacePath: root, artifactDir: root });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe(path.join("src", "key.ts"));
    expect(findings[0]?.rule).toBe("private-key");
  });

  it("ignores node_modules", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
    await writeFile(
      path.join(root, "node_modules", "pkg", "index.js"),
      "const token = 'AKIAABCDEFGHIJKLMNOP';\n",
    );

    expect(await scanSecrets({ workspacePath: root, artifactDir: root })).toHaveLength(0);
  });

  it("prefers the diff and only inspects added lines", async () => {
    const root = await workspace();
    const diffPath = path.join(root, "changes.diff");
    await writeFile(
      diffPath,
      [
        "--- a/src/config.ts",
        "+++ b/src/config.ts",
        "-const old = '----BEGIN PRIVATE KEY-----';",
        "+const next = process.env.DATABASE_URL;",
        "",
      ].join("\n"),
    );

    const findings = await scanSecrets({ workspacePath: root, artifactDir: root, diffPath });
    expect(findings).toHaveLength(0);
  });
});
