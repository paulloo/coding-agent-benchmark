const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|passw|credential|authorization|private[_-]?key)/i;
const CONNECTION_STRING_PATTERN = /(postgres(?:ql)?:\/\/[^:\s/]+:)([^@\s/]+)(@)/gi;

/** Keeps non-secret variables intact and replaces secret values with a marker. */
export function redactEnvironment(
  environment: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) {
      continue;
    }
    result[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : value;
  }
  return result;
}

export function collectSecretValues(environment: Record<string, string | undefined>): string[] {
  return Object.entries(environment)
    .filter(([key, value]) => SECRET_KEY_PATTERN.test(key) && typeof value === "string" && value.length >= 4)
    .map(([, value]) => value as string);
}

/** Removes known secret values and credentials embedded in connection strings. */
export function redactText(text: string, secretValues: readonly string[] = []): string {
  let output = text.replace(CONNECTION_STRING_PATTERN, "$1[REDACTED]$3");
  for (const secret of secretValues) {
    if (secret.length >= 4) {
      output = output.split(secret).join("[REDACTED]");
    }
  }
  return output;
}
