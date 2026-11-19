import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const PROMPTS_ROOT = fileURLToPath(new URL("../prompts", import.meta.url));

export const taskCategorySchema = z.enum([
  "UNDERSTANDING",
  "FEATURE_DEVELOPMENT",
  "DEBUGGING",
  "UI",
  "CODE_REVIEW",
  "DELIVERY",
]);

export type TaskCategoryName = z.infer<typeof taskCategorySchema>;

const variableSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  description: z.string().min(1),
  required: z.boolean(),
});

export const promptManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  version: z.number().int().positive(),
  category: taskCategorySchema,
  description: z.string().min(1),
  weight: z.number().int().min(1).max(100),
  timeoutSeconds: z.number().int().min(60),
  baseRef: z.string().nullable(),
  variables: z.array(variableSchema),
  expectedOutput: z.array(z.string().min(1)).min(1),
  scoringRules: z.array(z.string().min(1)).min(1),
  requiredChecks: z.array(z.string().min(1)),
});

export type PromptManifest = z.infer<typeof promptManifestSchema>;

export interface LoadedPrompt {
  manifest: PromptManifest;
  content: string;
  directory: string;
}

/**
 * Loads every prompt directory under `root`. Each directory must contain a
 * manifest.json and a markdown file named after the manifest version.
 */
export async function loadPrompts(root: string = PROMPTS_ROOT): Promise<LoadedPrompt[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const prompts: LoadedPrompt[] = [];
  for (const name of directories) {
    const directory = path.join(root, name);
    const manifestPath = path.join(directory, "manifest.json");
    const rawManifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    const manifest = promptManifestSchema.parse(rawManifest);
    const contentPath = path.join(directory, `v${manifest.version}.md`);
    const content = await readFile(contentPath, "utf8");
    prompts.push({ manifest, content, directory });
  }

  const ids = prompts.map((prompt) => prompt.manifest.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate prompt ids found under ${root}: ${ids.join(", ")}`);
  }

  return prompts;
}

/**
 * Replaces {{variable}} placeholders. Unknown placeholders and missing
 * required variables are hard errors so a run can never be executed with a
 * partially rendered prompt.
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string>,
  required: readonly string[] = [],
): string {
  const missing = required.filter((name) => variables[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required prompt variables: ${missing.join(", ")}`);
  }

  const rendered = template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) {
      throw new Error(`Prompt references undefined variable: ${name}`);
    }
    return value;
  });

  const unresolved = rendered.match(/\{\{\s*[^}]*\}\}/g);
  if (unresolved) {
    throw new Error(`Unresolved placeholders in prompt: ${unresolved.join(", ")}`);
  }

  return rendered;
}

export function buildInputSchema(manifest: PromptManifest) {
  return {
    type: "object",
    properties: Object.fromEntries(
      manifest.variables.map((variable) => [
        variable.name,
        { type: "string", description: variable.description },
      ]),
    ),
    required: manifest.variables.filter((variable) => variable.required).map((variable) => variable.name),
    additionalProperties: false,
  };
}
