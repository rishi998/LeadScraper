import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const EvidenceSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website' },
    auditRunId: { type: Schema.Types.ObjectId, ref: 'AuditRun', index: true },
    crawlPageId: { type: Schema.Types.ObjectId, ref: 'CrawlPage' },
    field: { type: String, required: true, index: true },
    value: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ['BUSINESS_WEBSITE', 'DISCOVERY_PROVIDER', 'STRUCTURED_DATA', 'MANUAL', 'SYSTEM'],
      required: true,
    },
    sourceUrl: String,
    method: { type: String, required: true },
    confidence: { type: Number, required: true },
    verificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'CONFIRMED', 'LIKELY', 'REJECTED'],
      default: 'UNVERIFIED',
    },
    observedAt: { type: Date, default: Date.now },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true, collection: 'evidence' },
);

EvidenceSchema.index({ businessId: 1, observedAt: -1 });

export type EvidenceDocument = InferSchemaType<typeof EvidenceSchema> & {
  _id: Types.ObjectId;
};

export const EvidenceModel: Model<EvidenceDocument> =
  (models.Evidence as Model<EvidenceDocument>) || model<EvidenceDocument>('Evidence', EvidenceSchema);
