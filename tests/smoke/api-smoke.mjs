import { Client } from "pg";

const base = process.env.CAB_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const runName = "smoke-api";
const results = [];

function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition), extra });
}

async function get(path) {
  const response = await fetch(base + path);
  const text = await response.text();
  return { response, text, body: () => JSON.parse(text) };
}

async function cleanup(databaseUrl) {
  if (!databaseUrl) {
    return;
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("delete from benchmark_runs where name = $1", [runName]);
  } finally {
    await client.end();
  }
}

async function main() {
  await cleanup(process.env.DATABASE_URL);
  try {
    const home = await get("/");
    check("dashboard 返回 200", home.response.status === 200);
    check("dashboard 渲染中文标题", home.text.includes("总览"));

    const agents = await get("/agents");
    check("agents 页面列出 Claude Code", agents.response.status === 200 && agents.text.includes("Claude Code"));

    const tasks = await get("/tasks");
    check(
      "tasks 页面包含时区任务",
      tasks.response.status === 200 && tasks.text.includes("时区日期筛选"),
    );

    const leaderboard = await get("/leaderboard");
    check(
      "leaderboard 展示空状态而不是假分数",
      leaderboard.response.status === 200 && leaderboard.text.includes("暂无评分数据"),
    );

    const createResponse = await fetch(base + "/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: runName,
        taskKeys: ["delivery"],
        agentSlugs: ["claude-code"],
        repetitions: 1,
      }),
    });
    const created = await createResponse.json();
    check("创建批次返回 201", createResponse.status === 201, JSON.stringify(created).slice(0, 300));
    const runId = created.run?.id;
    check("执行矩阵生成一条运行", created.run?._count?.agentRuns === 1);

    const detail = await get("/api/runs/" + runId);
    check("批次详情可读取", detail.response.status === 200 && detail.body().run.id === runId);

    const resultsResponse = await get("/api/runs/" + runId + "/results");
    const resultsBody = resultsResponse.body();
    check(
      "结果接口返回运行记录",
      resultsResponse.response.status === 200 &&
        Array.isArray(resultsBody.results) &&
        resultsBody.results.length === 1,
    );

    const report = await get("/api/reports/" + runId);
    check(
      "报告接口返回 agentRuns",
      report.response.status === 200 && report.text.includes("agentRuns"),
    );

    const logs = await get("/api/runs/" + runId + "/logs");
    check("日志列表接口可用", logs.response.status === 200 && logs.body().agentRuns.length === 1);

    const cancel = await fetch(base + "/api/runs/" + runId + "/cancel", { method: "POST" });
    check("取消批次成功", cancel.status === 200);

    const cancelAgain = await fetch(base + "/api/runs/" + runId + "/cancel", { method: "POST" });
    check("重复取消返回 409", cancelAgain.status === 409);

    const page = await get("/runs/" + runId);
    check("批次页面可渲染", page.response.status === 200 && page.text.includes(runName));

    const unknownAgent = await fetch(base + "/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "bad", agentSlugs: ["nope"] }),
    });
    check("未知 Agent 返回 400", unknownAgent.status === 400);

    const invalidBody = await fetch(base + "/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    check("参数校验返回 400", invalidBody.status === 400);

    const missing = await get("/api/runs/does-not-exist");
    check("不存在的批次返回 404", missing.response.status === 404);
  } finally {
    await cleanup(process.env.DATABASE_URL);
  }

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.ok ? "" : `  ${result.extra}`}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
