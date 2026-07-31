import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const ProcessingJobSchema = new Schema(
  {
    searchJobId: { type: Schema.Types.ObjectId, ref: 'SearchJob', index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
    type: {
      type: String,
      enum: [
        'DISCOVERY',
        'ENTITY_RESOLUTION',
        'WEBSITE_VERIFICATION',
        'CRAWL',
        'CONTACT_EXTRACTION',
        'AUDIT',
        'TECHNOLOGY',
        'SCORING',
        'ENRICHMENT',
        'AI_ANALYSIS',
        'EXPORT',
      ],
      required: true,
      index: true,
    },
    stage: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    priority: { type: Number, default: 100 },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: Schema.Types.Mixed,
    availableAt: { type: Date, default: Date.now },
    lockedAt: Date,
    lockedBy: String,
    lastError: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, collection: 'processing_jobs' },
);

ProcessingJobSchema.index({ status: 1, availableAt: 1, priority: -1, createdAt: 1 });
ProcessingJobSchema.index({ status: 1, lockedAt: 1 });

export type ProcessingJobDocument = InferSchemaType<typeof ProcessingJobSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ProcessingJobModel: Model<ProcessingJobDocument> =
  (models.ProcessingJob as Model<ProcessingJobDocument>) ||
  model<ProcessingJobDocument>('ProcessingJob', ProcessingJobSchema);
