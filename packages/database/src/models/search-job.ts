import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const DiscoveryQuerySchema = new Schema(
  {
    city: String,
    locality: String,
    category: String,
    categoryAlias: String,
    queryText: { type: String, required: true },
    providerId: String,
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    resultCount: { type: Number, default: 0 },
    metadata: Schema.Types.Mixed,
  },
  { _id: true },
);

const SearchJobSchema = new Schema(
  {
    city: { type: String, required: true, index: true },
    state: String,
    country: { type: String, required: true },
    localities: { type: [String], default: [] },
    categories: { type: [String], required: true },
    categoryAliases: { type: Schema.Types.Mixed, default: {} },
    targetLeadCount: { type: Number, default: 100 },
    minimumOpportunityScore: { type: Number, default: 60 },
    enablePremiumEnrichment: { type: Boolean, default: false },
    enableAIAnalysis: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['CREATED', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'CREATED',
      index: true,
    },
    currentStage: String,
    totalCandidates: { type: Number, default: 0 },
    totalBusinesses: { type: Number, default: 0 },
    processedBusinesses: { type: Number, default: 0 },
    successfulBusinesses: { type: Number, default: 0 },
    failedBusinesses: { type: Number, default: 0 },
    progressPercent: { type: Number, default: 0 },
    tierReached: { type: Number, default: 0 },
    progress: { type: Schema.Types.Mixed, default: {} },
    discoveryQueries: { type: [DiscoveryQuerySchema], default: [] },
    businessIds: [{ type: Schema.Types.ObjectId, ref: 'Business' }],
    errorMessage: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, collection: 'search_jobs' },
);

SearchJobSchema.index({ createdAt: -1 });

export type SearchJobDocument = InferSchemaType<typeof SearchJobSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SearchJobModel: Model<SearchJobDocument> =
  (models.SearchJob as Model<SearchJobDocument>) ||
  model<SearchJobDocument>('SearchJob', SearchJobSchema);
