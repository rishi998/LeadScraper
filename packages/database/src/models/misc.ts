import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const OutreachSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true,
    },
    assignee: String,
    status: String,
    contactMethod: String,
    firstContact: Date,
    lastContact: Date,
    nextFollowUp: Date,
    response: String,
    interested: Boolean,
    objection: String,
    proposalSent: Boolean,
    proposalValue: Number,
    outcome: String,
    revenue: Number,
    notes: String,
  },
  { timestamps: true, collection: 'outreach' },
);

export type OutreachDocument = InferSchemaType<typeof OutreachSchema> & {
  _id: Types.ObjectId;
};

export const OutreachModel: Model<OutreachDocument> =
  (models.Outreach as Model<OutreachDocument>) || model<OutreachDocument>('Outreach', OutreachSchema);

const ExportRunSchema = new Schema(
  {
    searchJobId: { type: Schema.Types.ObjectId, ref: 'SearchJob', index: true },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    filterSnapshot: Schema.Types.Mixed,
    filePath: String,
    rowCount: Number,
    errorMessage: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, collection: 'export_runs' },
);

export type ExportRunDocument = InferSchemaType<typeof ExportRunSchema> & {
  _id: Types.ObjectId;
};

export const ExportRunModel: Model<ExportRunDocument> =
  (models.ExportRun as Model<ExportRunDocument>) ||
  model<ExportRunDocument>('ExportRun', ExportRunSchema);

const SourceSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
    searchJobId: { type: Schema.Types.ObjectId, ref: 'SearchJob' },
    providerId: { type: String, required: true },
    externalId: String,
    rawPayload: Schema.Types.Mixed,
    queryText: String,
    observedAt: { type: Date, default: Date.now },
    storagePolicy: Schema.Types.Mixed,
  },
  { timestamps: true, collection: 'sources' },
);

SourceSchema.index({ providerId: 1, externalId: 1 });

export type SourceDocument = InferSchemaType<typeof SourceSchema> & {
  _id: Types.ObjectId;
};

export const SourceModel: Model<SourceDocument> =
  (models.Source as Model<SourceDocument>) || model<SourceDocument>('Source', SourceSchema);

const TechnologySchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true },
    category: String,
    confidence: { type: Number, default: 0 },
    evidenceId: { type: Schema.Types.ObjectId, ref: 'Evidence' },
    detectedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'local' },
    version: String,
    signal: String,
  },
  { timestamps: true, collection: 'technologies' },
);

export type TechnologyDocument = InferSchemaType<typeof TechnologySchema> & {
  _id: Types.ObjectId;
};

export const TechnologyModel: Model<TechnologyDocument> =
  (models.Technology as Model<TechnologyDocument>) ||
  model<TechnologyDocument>('Technology', TechnologySchema);
