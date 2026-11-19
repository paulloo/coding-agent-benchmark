import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border border-line bg-card p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-card/60 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{description}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-line/60 text-ink-soft",
  QUEUED: "bg-muted text-primary-dark",
  RUNNING: "bg-[#e6f0ff] text-[#2f5fa8]",
  COMPLETED: "bg-muted text-primary-dark",
  FAILED: "bg-[#f9e5e0] text-danger",
  CANCELLED: "bg-line/60 text-ink-soft",
  PENDING: "bg-line/60 text-ink-soft",
  TIMEOUT: "bg-[#fbf0dc] text-warning",
  SKIPPED: "bg-line/60 text-ink-soft",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-line/60 text-ink-soft",
      )}
    >
      {status}
    </span>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-line/70 px-3 py-3 align-middle", className)}>{children}</td>;
}
