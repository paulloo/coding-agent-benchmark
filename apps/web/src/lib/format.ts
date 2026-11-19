export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) {
    return "—";
  }
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)} 秒`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes < 60) {
    return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
}

export function formatScore(value: unknown): string {
  if (value === null || value === undefined) {
    return "数据缺失";
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return "数据缺失";
  }
  return number.toFixed(1);
}

export function formatCost(value: unknown): string {
  if (value === null || value === undefined) {
    return "不可用";
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return "不可用";
  }
  return `$${number.toFixed(4)}`;
}

export function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "不可用";
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
