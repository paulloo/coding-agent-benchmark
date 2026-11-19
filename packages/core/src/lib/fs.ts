import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface WrittenArtifact {
  path: string;
  checksum: string;
  size: number;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function ensureDir(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function writeArtifact(
  directory: string,
  fileName: string,
  content: string,
): Promise<WrittenArtifact> {
  await ensureDir(directory);
  const filePath = path.join(directory, fileName);
  const buffer = Buffer.from(content, "utf8");
  await writeFile(filePath, buffer);
  const info = await stat(filePath);
  return { path: filePath, checksum: sha256(buffer), size: info.size };
}

/** Turns arbitrary identifiers into a single safe path segment. */
export function toPathSegment(value: string): string {
  const segment = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!segment) {
    throw new Error(`Cannot derive a path segment from "${value}"`);
  }
  return segment.slice(0, 120);
}
