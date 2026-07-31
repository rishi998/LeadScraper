import { WORKER_DEFAULTS } from '@leadintel/shared';

/** In-process per-domain concurrency for crawl/audit fetches. */
export class DomainConcurrencyGate {
  private readonly active = new Map<string, number>();
  private readonly waiters = new Map<string, Array<() => void>>();
  private globalActive = 0;
  private globalWaiters: Array<() => void> = [];

  constructor(
    private readonly globalLimit: number = WORKER_DEFAULTS.globalCrawlConcurrency,
    private readonly perDomainLimit: number = WORKER_DEFAULTS.perDomainConcurrency,
    private readonly delayMs: number = WORKER_DEFAULTS.domainDelayMs,
  ) {}

  async run<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    await this.acquireGlobal();
    try {
      await this.acquireDomain(domain);
      try {
        if (this.delayMs > 0) await sleep(this.delayMs);
        return await fn();
      } finally {
        this.releaseDomain(domain);
      }
    } finally {
      this.releaseGlobal();
    }
  }

  private acquireGlobal(): Promise<void> {
    if (this.globalActive < this.globalLimit) {
      this.globalActive += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.globalWaiters.push(() => {
        this.globalActive += 1;
        resolve();
      });
    });
  }

  private releaseGlobal(): void {
    this.globalActive = Math.max(0, this.globalActive - 1);
    const next = this.globalWaiters.shift();
    if (next) next();
  }

  private acquireDomain(domain: string): Promise<void> {
    const key = domain.toLowerCase();
    const current = this.active.get(key) ?? 0;
    if (current < this.perDomainLimit) {
      this.active.set(key, current + 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const list = this.waiters.get(key) ?? [];
      list.push(() => {
        this.active.set(key, (this.active.get(key) ?? 0) + 1);
        resolve();
      });
      this.waiters.set(key, list);
    });
  }

  private releaseDomain(domain: string): void {
    const key = domain.toLowerCase();
    const current = this.active.get(key) ?? 0;
    const nextVal = Math.max(0, current - 1);
    if (nextVal === 0) this.active.delete(key);
    else this.active.set(key, nextVal);
    const list = this.waiters.get(key);
    const next = list?.shift();
    if (next) next();
    if (list && list.length === 0) this.waiters.delete(key);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
