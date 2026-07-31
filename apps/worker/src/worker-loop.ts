import {
  DomainConcurrencyGate,
  isPermanentError,
  toPayload,
  type ClaimedJob,
  type JobQueue,
} from '@leadintel/job-queue';
import { ProcessingJobType, WORKER_DEFAULTS, extractDomain } from '@leadintel/shared';
import pino from 'pino';
import {
  processAudit,
  processContactExtraction,
  processCrawl,
  processDiscovery,
  processEntityResolution,
  processExport,
  processScoring,
  processWebsiteVerification,
  finalizeSearchJobFailure,
} from './processors';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export type WorkerConfig = {
  workerId: string;
  concurrency: number;
  pollIntervalMs: number;
  lockTimeoutMs: number;
  staleRecoveryIntervalMs: number;
  globalCrawlConcurrency: number;
  perDomainConcurrency: number;
  domainDelayMs: number;
};

export function loadWorkerConfig(): WorkerConfig {
  return {
    workerId: process.env.WORKER_ID ?? `worker-${process.pid}`,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? WORKER_DEFAULTS.concurrency),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? WORKER_DEFAULTS.pollIntervalMs),
    lockTimeoutMs: Number(process.env.WORKER_LOCK_TIMEOUT_MS ?? WORKER_DEFAULTS.lockTimeoutMs),
    staleRecoveryIntervalMs: Number(
      process.env.WORKER_STALE_RECOVERY_INTERVAL_MS ?? WORKER_DEFAULTS.staleRecoveryIntervalMs,
    ),
    globalCrawlConcurrency: Number(
      process.env.GLOBAL_CRAWL_CONCURRENCY ?? WORKER_DEFAULTS.globalCrawlConcurrency,
    ),
    perDomainConcurrency: Number(
      process.env.PER_DOMAIN_CONCURRENCY ?? WORKER_DEFAULTS.perDomainConcurrency,
    ),
    domainDelayMs: Number(process.env.DOMAIN_DELAY_MS ?? WORKER_DEFAULTS.domainDelayMs),
  };
}

export class WorkerLoop {
  private running = false;
  private shuttingDown = false;
  private active = 0;
  private lastStaleRecovery = 0;
  private readonly domainGate: DomainConcurrencyGate;

  constructor(
    private readonly queue: JobQueue,
    private readonly config: WorkerConfig,
  ) {
    this.domainGate = new DomainConcurrencyGate(
      config.globalCrawlConcurrency,
      config.perDomainConcurrency,
      config.domainDelayMs,
    );
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info(
      {
        workerId: this.config.workerId,
        concurrency: this.config.concurrency,
        pollIntervalMs: this.config.pollIntervalMs,
      },
      'worker loop started',
    );

    while (this.running && !this.shuttingDown) {
      try {
        await this.maybeRecoverStale();
        const slots = this.config.concurrency - this.active;
        if (slots <= 0) {
          await sleep(this.config.pollIntervalMs);
          continue;
        }

        const jobs = await this.queue.claim(this.config.workerId, slots);
        if (jobs.length === 0) {
          await sleep(this.config.pollIntervalMs);
          continue;
        }

        for (const job of jobs) {
          this.active += 1;
          void this.execute(job).finally(() => {
            this.active -= 1;
          });
        }
      } catch (err) {
        logger.error({ err }, 'worker poll error');
        await sleep(this.config.pollIntervalMs);
      }
    }

    while (this.active > 0) {
      await sleep(100);
    }
  }

  async stop(): Promise<void> {
    this.shuttingDown = true;
    this.running = false;
    logger.info({ active: this.active }, 'worker shutting down');
    while (this.active > 0) {
      await sleep(100);
    }
  }

  private async maybeRecoverStale(): Promise<void> {
    const now = Date.now();
    if (now - this.lastStaleRecovery < this.config.staleRecoveryIntervalMs) return;
    this.lastStaleRecovery = now;
    const recovered = await this.queue.recoverStale(this.config.lockTimeoutMs);
    if (recovered > 0) {
      logger.warn({ recovered }, 'recovered stale processing jobs');
    }
  }

  private async execute(job: ClaimedJob): Promise<void> {
    const started = Date.now();
    try {
      await this.dispatch(job);
      await this.queue.complete(job.id, { ok: true });
      logger.info(
        {
          jobId: job.id,
          type: job.type,
          searchJobId: job.searchJobId,
          businessId: job.businessId,
          stage: job.stage,
          status: 'COMPLETED',
          duration: Date.now() - started,
        },
        'job completed',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanent = isPermanentError(err);
      await this.queue.fail(job.id, message, { permanent });
      if (
        permanent &&
        job.searchJobId &&
        (job.type === ProcessingJobType.DISCOVERY ||
          job.type === ProcessingJobType.ENTITY_RESOLUTION)
      ) {
        try {
          await finalizeSearchJobFailure(job.searchJobId, message);
        } catch (finalizeErr) {
          logger.error(
            { err: finalizeErr, searchJobId: job.searchJobId },
            'failed to finalize search job after pipeline error',
          );
        }
      }
      logger.error(
        {
          jobId: job.id,
          type: job.type,
          searchJobId: job.searchJobId,
          businessId: job.businessId,
          stage: job.stage,
          status: 'FAILED',
          duration: Date.now() - started,
          error: message,
          permanent,
        },
        'job failed',
      );
    }
  }

  private async dispatch(job: ClaimedJob): Promise<void> {
    const payload = toPayload(job);
    const type = job.type as ProcessingJobType;

    switch (type) {
      case ProcessingJobType.DISCOVERY:
        await processDiscovery(payload as { searchJobId: string }, this.queue);
        break;
      case ProcessingJobType.ENTITY_RESOLUTION:
        await processEntityResolution(payload as { searchJobId: string }, this.queue);
        break;
      case ProcessingJobType.WEBSITE_VERIFICATION:
        await processWebsiteVerification(
          payload as { searchJobId: string; businessId: string },
          this.queue,
        );
        break;
      case ProcessingJobType.CRAWL: {
        const data = payload as { searchJobId: string; businessId: string; websiteId: string };
        const domain =
          typeof payload.domain === 'string'
            ? payload.domain
            : extractDomain(String(payload.websiteUrl ?? '')) ?? 'unknown';
        await this.domainGate.run(domain, () => processCrawl(data, this.queue));
        break;
      }
      case ProcessingJobType.CONTACT_EXTRACTION:
        await processContactExtraction(
          payload as { searchJobId: string; businessId: string; crawlRunId: string },
          this.queue,
        );
        break;
      case ProcessingJobType.AUDIT:
      case ProcessingJobType.TECHNOLOGY:
        await processAudit(
          payload as { searchJobId: string; businessId: string; crawlRunId: string },
          this.queue,
        );
        break;
      case ProcessingJobType.SCORING:
        await processScoring(
          payload as { searchJobId: string; businessId: string; auditRunId?: string },
        );
        break;
      case ProcessingJobType.EXPORT:
        await processExport(payload as { exportRunId: string });
        break;
      case ProcessingJobType.ENRICHMENT:
      case ProcessingJobType.AI_ANALYSIS:
        logger.info({ type }, 'optional stage skipped in Phase 1');
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
