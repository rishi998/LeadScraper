import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const ScoreSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    auditRunId: { type: Schema.Types.ObjectId, ref: 'AuditRun' },
    algorithmVersion: { type: String, required: true },
    websiteHealth: Number,
    marketReadiness: Number,
    conversionReadiness: Number,
    businessVitality: Number,
    contactConfidence: Number,
    salesOpportunity: Number,
    auditConfidence: Number,
    priority: { type: String, enum: ['HOT', 'WARM', 'REVIEW', 'LOW'] },
    modifiers: { type: [String], default: [] },
    components: { type: Schema.Types.Mixed, default: {} },
    dataQualityGrade: { type: String, enum: ['A', 'B', 'C', 'D'] },
    scoredAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'scores' },
);

ScoreSchema.index({ businessId: 1, scoredAt: -1 });

export type ScoreDocument = InferSchemaType<typeof ScoreSchema> & {
  _id: Types.ObjectId;
};

export const ScoreModel: Model<ScoreDocument> =
  (models.Score as Model<ScoreDocument>) || model<ScoreDocument>('Score', ScoreSchema);

const RecommendationSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    scoreId: { type: Schema.Types.ObjectId, ref: 'Score' },
    service: { type: String, required: true },
    priority: { type: Number, required: true },
    reason: { type: String, required: true },
    evidenceIds: { type: [String], default: [] },
    ruleId: { type: String, required: true },
  },
  { timestamps: true, collection: 'recommendations' },
);

export type RecommendationDocument = InferSchemaType<typeof RecommendationSchema> & {
  _id: Types.ObjectId;
};

export const RecommendationModel: Model<RecommendationDocument> =
  (models.Recommendation as Model<RecommendationDocument>) ||
  model<RecommendationDocument>('Recommendation', RecommendationSchema);
