import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ExportRunModel, ProcessingJobModel, idString } from '@leadintel/database';
import type { JobQueue } from '@leadintel/job-queue';
import { ProcessingJobType, ProcessingJobStatus, type ExportCreateInput } from '@leadintel/shared';
import { unlink } from 'node:fs/promises';
import { JOB_QUEUE } from './tokens';
import { resolveExportFilePath } from './export-paths';

@Injectable()
export class ExportsService {
  constructor(@Inject(JOB_QUEUE) private readonly jobQueue: JobQueue) {}

  async create(input: ExportCreateInput) {
    const run = await ExportRunModel.create({
      searchJobId: input.searchJobId,
      filterSnapshot: input.filters,
      status: 'PENDING',
    });
    await this.jobQueue.enqueue({
      type: ProcessingJobType.EXPORT,
      searchJobId: input.searchJobId,
      payload: { exportRunId: idString(run._id) },
      priority: 95,
    });
    return { id: idString(run._id), ...run.toObject(), _id: undefined };
  }

  async list() {
    const docs = await ExportRunModel.find().sort({ createdAt: -1 }).limit(50).lean();
    return docs.map((d) => ({ id: idString(d._id), ...d, _id: undefined }));
  }

  async get(id: string) {
    const d = await ExportRunModel.findById(id).lean();
    if (!d) return null;
    return { id: idString(d._id), ...d, _id: undefined };
  }

  async delete(id: string) {
    const run = await ExportRunModel.findById(id);
    if (!run) throw new NotFoundException('Export not found');

    await ProcessingJobModel.updateMany(
      {
        type: ProcessingJobType.EXPORT,
        'payload.exportRunId': id,
        status: { $in: [ProcessingJobStatus.PENDING, ProcessingJobStatus.PROCESSING] },
      },
      {
        $set: {
          status: ProcessingJobStatus.CANCELLED,
          completedAt: new Date(),
        },
      },
    );

    if (run.filePath) {
      const absolute = resolveExportFilePath(run.filePath);
      if (absolute) {
        try {
          await unlink(absolute);
        } catch {
          // File may already be missing.
        }
      }
    }

    await ExportRunModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }
}
