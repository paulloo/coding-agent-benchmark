import { DIMENSION_LABELS, SCORE_DIMENSIONS, type ScoreDimension } from "@cab/core";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { buildLeaderboard, type LeaderboardEntry } from "@/server/leaderboard";
import { getPrisma } from "@/server/prisma";
import { formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

function bestBy(rows: LeaderboardEntry[], dimension: ScoreDimension): LeaderboardEntry | null {
  const candidates = rows.filter((row) => row.dimensions[dimension] !== null);
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((best, row) =>
    (row.dimensions[dimension] as number) > (best.dimensions[dimension] as number) ? row : best,
  );
}

const HIGHLIGHTS: Array<{ title: string; dimension: ScoreDimension; note: string }> = [
  { title: "最强编码能力", dimension: "quality", note: "代码质量维度均分最高" },
  { title: "最强自主能力", dimension: "autonomy", note: "人工干预最少" },
  { title: "最佳性价比", dimension: "cost", note: "成本维度均分最高" },
  { title: "最佳开发体验", dimension: "experience", note: "人工体验评分最高" },
];

export default async function LeaderboardPage() {
  let rows: LeaderboardEntry[] = [];
  let failure: string | null = null;

  try {
    rows = await buildLeaderboard(getPrisma());
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <>
      <PageHeader
        title="排行榜"
        description="总分只对已测量的维度加权，并同时给出覆盖率。缺少可信数据的维度显示为数据缺失，不会被当作 0 分。"
      />

      {failure ? (
        <Card className="border-danger/30 bg-[#fdf6f4]">
          <p className="text-sm font-medium text-danger">无法读取评分</p>
          <pre className="mt-3 overflow-x-auto text-xs text-ink-soft">{failure}</pre>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无评分数据"
          description="完成一次包含自动验收的评测批次后，评分会出现在这里。种子数据不会伪造任何评测分数。"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {HIGHLIGHTS.map((highlight) => {
              const winner = bestBy(rows, highlight.dimension);
              return (
                <Card key={highlight.dimension}>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                    {highlight.title}
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {winner ? winner.name : "数据缺失"}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {winner
                      ? `${DIMENSION_LABELS[highlight.dimension]} ${formatScore(
                          winner.dimensions[highlight.dimension],
                        )}`
                      : highlight.note}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="mt-6">
            <Table>
              <thead>
                <tr>
                  <Th>排名</Th>
                  <Th>Agent</Th>
                  <Th>总分</Th>
                  <Th>覆盖率</Th>
                  {SCORE_DIMENSIONS.map((dimension) => (
                    <Th key={dimension}>{DIMENSION_LABELS[dimension]}</Th>
                  ))}
                  <Th>样本</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.agentId}>
                    <Td className="text-ink-soft">{index + 1}</Td>
                    <Td>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-ink-soft">{row.vendor}</p>
                    </Td>
                    <Td className="text-base font-semibold tabular-nums">
                      {formatScore(row.totalScore)}
                    </Td>
                    <Td className="text-ink-soft">
                      {row.coverage === null ? "—" : `${Math.round(row.coverage * 100)}%`}
                    </Td>
                    {SCORE_DIMENSIONS.map((dimension) => (
                      <Td key={dimension} className="tabular-nums text-ink-soft">
                        {formatScore(row.dimensions[dimension])}
                      </Td>
                    ))}
                    <Td className="text-ink-soft">
                      {row.measuredRunCount}/{row.runCount}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
