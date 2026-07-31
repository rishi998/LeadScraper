import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const AuditMetricSchema = new Schema(
  {
    module: String,
    name: String,
    value: Number,
    valueText: String,
    unit: String,
    dataSource: { type: String, enum: ['LAB', 'FIELD', 'STATIC', 'HEURISTIC'], default: 'STATIC' },
    confidence: { type: Number, default: 1 },
  },
  { _id: false },
);

const AuditFindingSchema = new Schema(
  {
    module: String,
    severity: { type: String, enum: ['CRITICAL', 'MAJOR', 'MINOR', 'INFO'] },
    code: String,
    message: String,
    evidenceId: { type: Schema.Types.ObjectId, ref: 'Evidence' },
    metadata: Schema.Types.Mixed,
  },
  { _id: true },
);

const AuditRunSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true, index: true },
    crawlRunId: { type: Schema.Types.ObjectId, ref: 'CrawlRun' },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    version: String,
    scores: {
      seo: Number,
      security: Number,
      conversion: Number,
      technical: Number,
      performance: Number,
      accessibility: Number,
      mobileUx: Number,
    },
    metrics: {
      performance: Schema.Types.Mixed,
      seo: Schema.Types.Mixed,
      security: Schema.Types.Mixed,
      accessibility: Schema.Types.Mixed,
      mobileUx: Schema.Types.Mixed,
      conversion: Schema.Types.Mixed,
      technical: Schema.Types.Mixed,
      marketing: Schema.Types.Mixed,
    },
    metricList: { type: [AuditMetricSchema], default: [] },
    findings: { type: [AuditFindingSchema], default: [] },
    findingsSummary: {
      critical: { type: Number, default: 0 },
      major: { type: Number, default: 0 },
      minor: { type: Number, default: 0 },
    },
    confidence: Number,
    metadata: Schema.Types.Mixed,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, collection: 'audit_runs' },
);

AuditRunSchema.index({ businessId: 1, createdAt: -1 });

export type AuditRunDocument = InferSchemaType<typeof AuditRunSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const AuditRunModel: Model<AuditRunDocument> =
  (models.AuditRun as Model<AuditRunDocument>) || model<AuditRunDocument>('AuditRun', AuditRunSchema);
