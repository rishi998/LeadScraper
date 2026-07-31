import { ProcessingJobStatus, WORKER_DEFAULTS } from '@leadintel/shared';
import {
  type ClaimedJob,
  type EnqueueJobInput,
  type JobQueue,
  retryDelayMs,
} from './types';

function now(): Date {
  return new Date();
}

function cloneJob(job: ClaimedJob): ClaimedJob {
  return {
    ...job,
    payload: { ...job.payload },
    result: job.result ? { ...job.result } : null,
    availableAt: new Date(job.availableAt),
    lockedAt: job.lockedAt ? new Date(job.lockedAt) : null,
    startedAt: job.startedAt ? new Date(job.startedAt) : null,
    completedAt: job.completedAt ? new Date(job.completedAt) : null,
    createdAt: new Date(job.createdAt),
    updatedAt: new Date(job.updatedAt),
  };
}

/** Deterministic in-memory queue for unit tests (no MongoDB required). */
export class InMemoryJobQueue implements JobQueue {
  private jobs = new Map<string, ClaimedJob>();
  private claimLock = Promise.resolve();

  constructor(
    private readonly defaults: { maxAttempts?: number; retryBackoffMs?: readonly number[] } = {},
  ) {}

  getAll(): ClaimedJob[] {
    return [...this.jobs.values()].map(cloneJob);
  }

  get(id: string): ClaimedJob | undefined {
    const job = this.jobs.get(id);
    return job ? cloneJob(job) : undefined;
  }

  async enqueue(input: EnqueueJobInput): Promise<ClaimedJob> {
    const created = now();
    const job: ClaimedJob = {
      id: crypto.randomUUID(),
      searchJobId: input.searchJobId ?? null,
      businessId: input.businessId ?? null,
      type: String(input.type),
      stage: input.stage ?? String(input.type),
      status: ProcessingJobStatus.PENDING,
      priority: input.priority ?? 100,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? this.defaults.maxAttempts ?? WORKER_DEFAULTS.maxAttempts,
      lastError: null,
      payload: input.payload ?? {},
      result: null,
      availableAt: input.availableAt ?? created,
      lockedAt: null,
      lockedBy: null,
      startedAt: null,
      completedAt: null,
      createdAt: created,
      updatedAt: created,
    };
    this.jobs.set(job.id, job);
    return cloneJob(job);
  }

  async claim(workerId: string, limit: number): Promise<ClaimedJob[]> {
    return this.withLock(async () => {
      const t = now();
      const candidates = [...this.jobs.values()]
        .filter(
          (j) =>
            j.status === ProcessingJobStatus.PENDING &&
            j.availableAt.getTime() <= t.getTime(),
        )
        .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, limit);

      const claimed: ClaimedJob[] = [];
      for (const job of candidates) {
        job.status = ProcessingJobStatus.PROCESSING;
        job.lockedAt = t;
        job.lockedBy = workerId;
        job.startedAt = t;
        job.attempts += 1;
        job.updatedAt = t;
        claimed.push(cloneJob(job));
      }
      return claimed;
    });
  }

  async complete(jobId: string, result?: Record<string, unknown>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const t = now();
    job.status = ProcessingJobStatus.COMPLETED;
    job.result = result ?? null;
    job.completedAt = t;
    job.lockedAt = null;
    job.lockedBy = null;
    job.updatedAt = t;
  }

  async fail(
    jobId: string,
    error: string,
    options?: { permanent?: boolean },
  ): Promise<ClaimedJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.lastError = error;
    job.updatedAt = now();

    // attempts already incremented on claim
    if (!options?.permanent && job.attempts < job.maxAttempts) {
      const delay = retryDelayMs(
        job.attempts,
        this.defaults.retryBackoffMs ?? WORKER_DEFAULTS.retryBackoffMs,
      );
      if (delay != null) {
        return this.retry(jobId, error, new Date(Date.now() + delay));
      }
    }

    job.status = ProcessingJobStatus.FAILED;
    job.completedAt = now();
    job.lockedAt = null;
    job.lockedBy = null;
    return cloneJob(job);
  }

  async retry(jobId: string, error: string, availableAt: Date): Promise<ClaimedJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const t = now();
    job.status = ProcessingJobStatus.PENDING;
    job.lastError = error;
    job.availableAt = availableAt;
    job.lockedAt = null;
    job.lockedBy = null;
    job.startedAt = null;
    job.updatedAt = t;
    return cloneJob(job);
  }

  async recoverStale(lockTimeoutMs: number): Promise<number> {
    const cutoff = Date.now() - lockTimeoutMs;
    let recovered = 0;
    for (const job of this.jobs.values()) {
      if (
        job.status === ProcessingJobStatus.PROCESSING &&
        job.lockedAt &&
        job.lockedAt.getTime() < cutoff
      ) {
        if (job.attempts < job.maxAttempts) {
          job.status = ProcessingJobStatus.PENDING;
          job.availableAt = now();
          job.lockedAt = null;
          job.lockedBy = null;
          job.lastError = job.lastError ?? 'Stale lock recovered';
        } else {
          job.status = ProcessingJobStatus.FAILED;
          job.completedAt = now();
          job.lockedAt = null;
          job.lockedBy = null;
          job.lastError = job.lastError ?? 'Stale lock exceeded max attempts';
        }
        job.updatedAt = now();
        recovered += 1;
      }
    }
    return recovered;
  }

  async cancelBySearchJob(searchJobId: string): Promise<number> {
    let n = 0;
    for (const job of this.jobs.values()) {
      if (
        job.searchJobId === searchJobId &&
        (job.status === ProcessingJobStatus.PENDING || job.status === ProcessingJobStatus.PROCESSING)
      ) {
        job.status = ProcessingJobStatus.CANCELLED;
        job.completedAt = now();
        job.lockedAt = null;
        job.lockedBy = null;
        job.updatedAt = now();
        n += 1;
      }
    }
    return n;
  }

  private withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.claimLock.then(() => fn());
    this.claimLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
