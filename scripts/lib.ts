import { spawnSync } from "node:child_process";

export function executable(name: string): string {
  if (process.platform === "win32" && (name === "pnpm" || name === "npx")) {
    return `${name}.cmd`;
  }
  return name;
}

export interface RunStepOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowFailure?: boolean;
  quiet?: boolean;
}

export function runStep(
  label: string,
  command: string,
  args: readonly string[],
  options: RunStepOptions = {},
): number {
  if (!options.quiet) {
    console.log(`\n[${label}] ${command} ${args.join(" ")}`);
  }

  // Node refuses to execute .cmd shims without a shell on Windows. The shell
  // form is only used there, with every argument quoted explicitly.
  const useShell = process.platform === "win32";
  const quote = (value: string): string =>
    /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  const executableName = executable(command);
  const spawnCommand = useShell
    ? [executableName, ...args].map(quote).join(" ")
    : executableName;
  const spawnArgs = useShell ? [] : [...args];

  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: useShell,
  });

  if (result.error) {
    if (options.allowFailure) {
      return 1;
    }
    throw new Error(`${label} failed: ${result.error.message}`);
  }

  const status = result.status ?? 1;
  if (status !== 0 && !options.allowFailure) {
    throw new Error(`${label} exited with code ${status}`);
  }
  return status;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function requireYes(args: readonly string[], action: string): void {
  if (!args.includes("--yes")) {
    console.error(`该操作会${action}。确认后请追加 --yes 重新执行。`);
    process.exit(2);
  }
}
