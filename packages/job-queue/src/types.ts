import type { ProcessingJobStatus, ProcessingJobType } from '@leadintel/shared';

export interface EnqueueJobInput {
  type: ProcessingJobType | string;
  stage?: string;
  searchJobId?: string | null;
  businessId?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  availableAt?: Date;
}

export interface ClaimedJob {
  id: string;
  searchJobId: string | null;
  businessId: string | null;
  type: string;
  stage: string;
  status: ProcessingJobStatus | string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobQueue {
  enqueue(input: EnqueueJobInput): Promise<ClaimedJob>;
  claim(workerId: string, limit: number): Promise<ClaimedJob[]>;
  complete(jobId: string, result?: Record<string, unknown>): Promise<void>;
  fail(jobId: string, error: string, options?: { permanent?: boolean }): Promise<ClaimedJob | null>;
  retry(jobId: string, error: string, availableAt: Date): Promise<ClaimedJob | null>;
  recoverStale(lockTimeoutMs: number): Promise<number>;
  cancelBySearchJob(searchJobId: string): Promise<number>;
}

export class PermanentJobError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export function isPermanentError(err: unknown): boolean {
  if (err instanceof PermanentJobError) return true;
  if (err && typeof err === 'object' && 'permanent' in err && (err as { permanent?: boolean }).permanent) {
    return true;
  }
  return false;
}

/** Exponential-style backoff: attempt 1 → 5s, attempt 2 → 30s, then final failure. */
export function retryDelayMs(
  attemptsAfterFailure: number,
  backoffMs: readonly number[] = [5_000, 30_000],
): number | null {
  if (attemptsAfterFailure <= 0) return backoffMs[0] ?? 5_000;
  const idx = attemptsAfterFailure - 1;
  if (idx >= backoffMs.length) return null;
  return backoffMs[idx] ?? null;
}

export function toPayload(job: ClaimedJob): Record<string, unknown> {
  return {
    ...job.payload,
    searchJobId: job.searchJobId ?? job.payload.searchJobId,
    businessId: job.businessId ?? job.payload.businessId,
  };
}
