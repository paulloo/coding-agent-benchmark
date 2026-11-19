import { z } from "zod";

export const agentCategorySchema = z.enum(["CLI", "IDE", "EXTENSION", "CLOUD"]);

export const capabilitiesSchema = z.object({
  supportsStreaming: z.boolean().default(false),
  supportsHeadless: z.boolean().default(false),
  supportsMcp: z.boolean().default(false),
  supportsModelSelection: z.boolean().default(false),
  supportsTokenUsage: z.boolean().default(false),
  supportsCost: z.boolean().default(false),
});

export const createAgentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(64),
  name: z.string().min(1).max(120),
  vendor: z.string().min(1).max(120),
  category: agentCategorySchema,
  version: z.string().min(1).max(120).default("unknown"),
  adapter: z.string().min(1).max(64),
  enabled: z.boolean().default(true),
  capabilities: capabilitiesSchema.default({
    supportsStreaming: false,
    supportsHeadless: false,
    supportsMcp: false,
    supportsModelSelection: false,
    supportsTokenUsage: false,
    supportsCost: false,
  }),
});

export const updateAgentSchema = createAgentSchema.partial();

export const taskCategorySchema = z.enum([
  "UNDERSTANDING",
  "FEATURE_DEVELOPMENT",
  "DEBUGGING",
  "UI",
  "CODE_REVIEW",
  "DELIVERY",
]);

export const createTaskSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/).min(2).max(64),
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(2000),
  category: taskCategorySchema,
  promptVersionId: z.string().min(1),
  weight: z.number().int().min(1).max(100),
  timeoutSeconds: z.number().int().min(60).max(86_400),
  baseRef: z.string().min(1).max(200).nullable().default(null),
  requiredChecks: z.array(z.string().min(1)).max(20).default([]),
  enabled: z.boolean().default(true),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createRunSchema = z.object({
  name: z.string().min(1).max(160),
  mode: z.enum(["NATIVE", "CONTROLLED"]).default("NATIVE"),
  taskKeys: z.array(z.string().min(1)).min(1).max(20).optional(),
  agentSlugs: z.array(z.string().min(1)).min(1).max(50).optional(),
  repetitions: z.number().int().min(1).max(10).default(1),
});
