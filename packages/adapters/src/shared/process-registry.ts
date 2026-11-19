/**
 * Tracks in-flight CLI executions so a benchmark run can be cancelled from the
 * control plane without relying on OS-level signal delivery.
 */
export class ProcessRegistry {
  private readonly controllers = new Map<string, AbortController>();

  register(runId: string): AbortController {
    if (this.controllers.has(runId)) {
      throw new Error(`Run ${runId} is already executing`);
    }
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    return controller;
  }

  cancel(runId: string): boolean {
    const controller = this.controllers.get(runId);
    if (!controller) {
      return false;
    }
    controller.abort();
    return true;
  }

  release(runId: string): void {
    this.controllers.delete(runId);
  }

  get activeRunIds(): string[] {
    return [...this.controllers.keys()];
  }
}
