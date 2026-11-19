-- CreateEnum
CREATE TYPE "AgentCategory" AS ENUM ('CLI', 'IDE', 'EXTENSION', 'CLOUD');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('UNDERSTANDING', 'FEATURE_DEVELOPMENT', 'DEBUGGING', 'UI', 'CODE_REVIEW', 'DELIVERY');

-- CreateEnum
CREATE TYPE "BenchmarkMode" AS ENUM ('NATIVE', 'CONTROLLED');

-- CreateEnum
CREATE TYPE "BenchmarkRunStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "IsolationMode" AS ENUM ('CONTAINER', 'HOST');

-- CreateEnum
CREATE TYPE "EvaluationCategory" AS ENUM ('BUILD', 'TEST', 'SECURITY', 'QUALITY', 'DIFF');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('STDOUT', 'STDERR', 'DIFF', 'REPORT', 'SCREENSHOT', 'OTHER');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "category" "AgentCategory" NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'unknown',
    "adapter" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "expectedOutput" JSONB NOT NULL,
    "scoringRules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_tasks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "timeoutSeconds" INTEGER NOT NULL,
    "baseRef" TEXT,
    "requiredChecks" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BenchmarkRunStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "BenchmarkMode" NOT NULL DEFAULT 'NATIVE',
    "initialCommit" TEXT,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "benchmarkRunId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "model" TEXT,
    "modelVersion" TEXT,
    "reasoningEffort" TEXT,
    "repetitionIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "isolation" "IsolationMode" NOT NULL DEFAULT 'CONTAINER',
    "workspacePath" TEXT,
    "initialCommit" TEXT,
    "finalCommit" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "exitCode" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cachedTokens" INTEGER,
    "costUsd" DECIMAL(12,6),
    "stdoutPath" TEXT,
    "stderrPath" TEXT,
    "diffPath" TEXT,
    "environment" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_results" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "category" "EvaluationCategory" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" DECIMAL(6,2),
    "details" JSONB NOT NULL DEFAULT '{}',
    "rawLogPath" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_scores" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "completionScore" DECIMAL(6,2),
    "qualityScore" DECIMAL(6,2),
    "autonomyScore" DECIMAL(6,2),
    "speedScore" DECIMAL(6,2),
    "costScore" DECIMAL(6,2),
    "stabilityScore" DECIMAL(6,2),
    "experienceScore" DECIMAL(6,2),
    "totalScore" DECIMAL(6,2),
    "coverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "measuredDimensions" TEXT[],
    "missingDimensions" TEXT[],
    "scoredBy" TEXT NOT NULL DEFAULT 'automatic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_artifacts" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "path" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_slug_key" ON "agents"("slug");

-- CreateIndex
CREATE INDEX "agents_vendor_idx" ON "agents"("vendor");

-- CreateIndex
CREATE UNIQUE INDEX "prompts_slug_key" ON "prompts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_promptId_version_key" ON "prompt_versions"("promptId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_tasks_key_key" ON "benchmark_tasks"("key");

-- CreateIndex
CREATE INDEX "benchmark_tasks_category_idx" ON "benchmark_tasks"("category");

-- CreateIndex
CREATE INDEX "benchmark_runs_status_idx" ON "benchmark_runs"("status");

-- CreateIndex
CREATE INDEX "benchmark_runs_createdAt_idx" ON "benchmark_runs"("createdAt");

-- CreateIndex
CREATE INDEX "agent_runs_agentId_createdAt_idx" ON "agent_runs"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_benchmarkRunId_agentId_taskId_repetitionIndex_key" ON "agent_runs"("benchmarkRunId", "agentId", "taskId", "repetitionIndex");

-- CreateIndex
CREATE INDEX "evaluation_results_category_idx" ON "evaluation_results"("category");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_results_agentRunId_checkKey_key" ON "evaluation_results"("agentRunId", "checkKey");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_scores_agentRunId_key" ON "benchmark_scores"("agentRunId");

-- CreateIndex
CREATE INDEX "benchmark_artifacts_agentRunId_idx" ON "benchmark_artifacts"("agentRunId");

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_tasks" ADD CONSTRAINT "benchmark_tasks_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_benchmarkRunId_fkey" FOREIGN KEY ("benchmarkRunId") REFERENCES "benchmark_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "benchmark_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_scores" ADD CONSTRAINT "benchmark_scores_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_artifacts" ADD CONSTRAINT "benchmark_artifacts_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
