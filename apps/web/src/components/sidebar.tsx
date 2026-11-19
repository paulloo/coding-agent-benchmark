import { PawPrint } from "lucide-react";
import { NavLink } from "@/components/nav-link";

const NAVIGATION = [
  { href: "/", label: "总览" },
  { href: "/agents", label: "Agents" },
  { href: "/tasks", label: "任务" },
  { href: "/runs", label: "评测批次" },
  { href: "/leaderboard", label: "排行榜" },
] as const;

export function Sidebar() {
  return (
    <aside className="border-b border-line bg-card lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 px-5 py-5 lg:px-6">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
          <PawPrint aria-hidden className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Coding Agent</p>
          <p className="text-xs text-ink-soft">Benchmark Platform</p>
        </div>
      </div>

      <nav aria-label="主导航" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:px-3">
        {NAVIGATION.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>

      <div className="hidden px-6 py-4 text-xs leading-relaxed text-ink-soft lg:block">
        <p className="font-medium text-ink">执行平面</p>
        <p className="mt-1">DogWalk 基准项目以独立 Git 仓库维护，每次运行使用隔离 Worktree。</p>
      </div>
    </aside>
  );
}
