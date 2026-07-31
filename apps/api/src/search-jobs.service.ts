import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ProcessingJobModel, SearchJobModel, idString } from '@leadintel/database';
import type { JobQueue } from '@leadintel/job-queue';
import { JobStatus, ProcessingJobType, type SearchJobCreateInput } from '@leadintel/shared';
import { JOB_QUEUE } from './tokens';

@Injectable()
export class SearchJobsService {
  constructor(@Inject(JOB_QUEUE) private readonly jobQueue: JobQueue) {}

  async create(input: SearchJobCreateInput) {
    const doc = await SearchJobModel.create({
      city: input.city,
      state: input.state,
      country: input.country,
      localities: input.localities,
      categories: input.categories,
      categoryAliases: input.categoryAliases,
      targetLeadCount: input.targetLeadCount,
      minimumOpportunityScore: input.minimumOpportunityScore,
      enablePremiumEnrichment: input.enablePremiumEnrichment,
      enableAIAnalysis: input.enableAIAnalysis,
      status: JobStatus.CREATED,
      progressPercent: 0,
    });
    return this.serialize(doc);
  }

  async list() {
    const docs = await SearchJobModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((d) => this.serialize(d));
  }

  async get(id: string) {
    const doc = await SearchJobModel.findById(id).lean();
    if (!doc) return null;
    return {
      ...this.serialize(doc),
      discoveryQueries: doc.discoveryQueries ?? [],
      _count: {
        businesses: (doc.businessIds ?? []).length,
      },
    };
  }

  async start(id: string) {
    const job = await SearchJobModel.findById(id);
    if (!job) throw new NotFoundException('Search job not found');
    if (job.status === JobStatus.RUNNING) return this.serialize(job);

    job.status = JobStatus.RUNNING;
    job.errorMessage = undefined;
    job.startedAt = job.startedAt ?? new Date();
    job.currentStage = 'DISCOVERY';
    job.progressPercent = 0;
    await job.save();

    await this.jobQueue.enqueue({
      type: ProcessingJobType.DISCOVERY,
      searchJobId: id,
      payload: { searchJobId: id },
      priority: 100,
    });
    return this.serialize(job);
  }

  async cancel(id: string) {
    const job = await SearchJobModel.findById(id);
    if (!job) throw new NotFoundException('Search job not found');
    await this.jobQueue.cancelBySearchJob(id);
    job.status = JobStatus.CANCELLED;
    job.completedAt = new Date();
    job.currentStage = 'CANCELLED';
    await job.save();
    return this.serialize(job);
  }

  async delete(id: string) {
    const job = await SearchJobModel.findById(id);
    if (!job) throw new NotFoundException('Search job not found');

    await this.jobQueue.cancelBySearchJob(id);
    await ProcessingJobModel.deleteMany({ searchJobId: id });
    await SearchJobModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  private serialize(doc: unknown) {
    const d = doc as {
      _id: { toString(): string };
      toObject?: () => Record<string, unknown>;
    };
    const raw =
      typeof d.toObject === 'function' ? d.toObject() : { ...(doc as object) };
    const { _id, __v, ...rest } = raw as Record<string, unknown> & {
      _id: { toString(): string };
      __v?: unknown;
    };
    return { id: idString(_id), ...rest };
  }
}
