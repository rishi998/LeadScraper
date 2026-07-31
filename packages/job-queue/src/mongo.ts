import {
  ProcessingJobModel,
  idString,
  type ProcessingJobDocument,
} from '@leadintel/database';
import { ProcessingJobStatus, WORKER_DEFAULTS } from '@leadintel/shared';
import { Types } from 'mongoose';
import {
  type ClaimedJob,
  type EnqueueJobInput,
  type JobQueue,
  retryDelayMs,
} from './types';

function mapDoc(doc: ProcessingJobDocument): ClaimedJob {
  return {
    id: idString(doc._id),
    searchJobId: doc.searchJobId ? idString(doc.searchJobId) : null,
    businessId: doc.businessId ? idString(doc.businessId) : null,
    type: String(doc.type),
    stage: String(doc.stage),
    status: String(doc.status),
    priority: doc.priority ?? 100,
    attempts: doc.attempts ?? 0,
    maxAttempts: doc.maxAttempts ?? 3,
    lastError: doc.lastError ?? null,
    payload: (doc.payload as Record<string, unknown>) ?? {},
    result: (doc.result as Record<string, unknown> | null) ?? null,
    availableAt: doc.availableAt ?? new Date(),
    lockedAt: doc.lockedAt ?? null,
    lockedBy: doc.lockedBy ?? null,
    startedAt: doc.startedAt ?? null,
    completedAt: doc.completedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toObjectId(id?: string | null): Types.ObjectId | undefined {
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) return undefined;
  return new Types.ObjectId(id);
}

export class MongoJobQueue implements JobQueue {
  constructor(
    private readonly defaults: { maxAttempts?: number; retryBackoffMs?: readonly number[] } = {},
  ) {}

  async enqueue(input: EnqueueJobInput): Promise<ClaimedJob> {
    const created = await ProcessingJobModel.create({
      type: input.type,
      stage: input.stage ?? String(input.type),
      searchJobId: toObjectId(input.searchJobId),
      businessId: toObjectId(input.businessId),
      payload: input.payload ?? {},
      priority: input.priority ?? 100,
      maxAttempts: input.maxAttempts ?? this.defaults.maxAttempts ?? WORKER_DEFAULTS.maxAttempts,
      availableAt: input.availableAt ?? new Date(),
      status: ProcessingJobStatus.PENDING,
      attempts: 0,
    });
    return mapDoc(created);
  }

  /**
   * Atomic claim via findOneAndUpdate — never find-then-update.
   * Priority descending, createdAt ascending. Increments attempts on claim.
   */
  async claim(workerId: string, limit: number): Promise<ClaimedJob[]> {
    const claimed: ClaimedJob[] = [];
    const now = new Date();

    for (let i = 0; i < limit; i++) {
      const doc = await ProcessingJobModel.findOneAndUpdate(
        {
          status: ProcessingJobStatus.PENDING,
          availableAt: { $lte: now },
        },
        {
          $set: {
            status: ProcessingJobStatus.PROCESSING,
            lockedAt: now,
            lockedBy: workerId,
            startedAt: now,
          },
          $inc: { attempts: 1 },
        },
        {
          sort: { priority: -1, createdAt: 1 },
          new: true,
        },
      );

      if (!doc) break;
      claimed.push(mapDoc(doc));
    }

    return claimed;
  }

  async complete(jobId: string, result?: Record<string, unknown>): Promise<void> {
    await ProcessingJobModel.findByIdAndUpdate(jobId, {
      $set: {
        status: ProcessingJobStatus.COMPLETED,
        result: result ?? null,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async fail(
    jobId: string,
    error: string,
    options?: { permanent?: boolean },
  ): Promise<ClaimedJob | null> {
    const job = await ProcessingJobModel.findById(jobId);
    if (!job) return null;

    const attempts = job.attempts ?? 0;
    if (!options?.permanent && attempts < (job.maxAttempts ?? 3)) {
      const delay = retryDelayMs(
        attempts,
        this.defaults.retryBackoffMs ?? WORKER_DEFAULTS.retryBackoffMs,
      );
      if (delay != null) {
        return this.retry(jobId, error, new Date(Date.now() + delay));
      }
    }

    const failed = await ProcessingJobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: ProcessingJobStatus.FAILED,
          lastError: error.slice(0, 4000),
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      },
      { new: true },
    );
    return failed ? mapDoc(failed) : null;
  }

  async retry(jobId: string, error: string, availableAt: Date): Promise<ClaimedJob | null> {
    const updated = await ProcessingJobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: ProcessingJobStatus.PENDING,
          lastError: error.slice(0, 4000),
          availableAt,
          lockedAt: null,
          lockedBy: null,
          startedAt: null,
        },
      },
      { new: true },
    );
    return updated ? mapDoc(updated) : null;
  }

  async recoverStale(lockTimeoutMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - lockTimeoutMs);
    const stale = await ProcessingJobModel.find({
      status: ProcessingJobStatus.PROCESSING,
      lockedAt: { $lt: cutoff },
    });

    let recovered = 0;
    for (const job of stale) {
      if ((job.attempts ?? 0) < (job.maxAttempts ?? 3)) {
        await ProcessingJobModel.findByIdAndUpdate(job._id, {
          $set: {
            status: ProcessingJobStatus.PENDING,
            availableAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: job.lastError ?? 'Stale lock recovered',
          },
        });
      } else {
        await ProcessingJobModel.findByIdAndUpdate(job._id, {
          $set: {
            status: ProcessingJobStatus.FAILED,
            completedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: job.lastError ?? 'Stale lock exceeded max attempts',
          },
        });
      }
      recovered += 1;
    }
    return recovered;
  }

  async cancelBySearchJob(searchJobId: string): Promise<number> {
    const result = await ProcessingJobModel.updateMany(
      {
        searchJobId: toObjectId(searchJobId),
        status: { $in: [ProcessingJobStatus.PENDING, ProcessingJobStatus.PROCESSING] },
      },
      {
        $set: {
          status: ProcessingJobStatus.CANCELLED,
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      },
    );
    return result.modifiedCount;
  }
}
