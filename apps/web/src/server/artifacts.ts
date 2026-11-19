import path from "node:path";
import { HttpError } from "./http";

/**
 * Artifact paths are stored by the runner. Serving them through the API is
 * only allowed when they resolve inside the configured artifact root.
 */
export function resolveArtifactPath(candidate: string): string {
  const root = path.resolve(process.env.CAB_ARTIFACT_ROOT ?? "./artifacts");
  const resolved = path.resolve(/* turbopackIgnore: true */ candidate);
  const normalize = (value: string) => (process.platform === "win32" ? value.toLowerCase() : value);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!normalize(resolved).startsWith(normalize(rootPrefix))) {
    throw new HttpError(403, "产物路径不在允许的产物目录内");
  }
  return resolved;
}
