import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const CurrentScoresSchema = new Schema(
  {
    websiteHealth: Number,
    marketReadiness: Number,
    conversionReadiness: Number,
    businessVitality: Number,
    contactConfidence: Number,
    salesOpportunity: Number,
    auditConfidence: Number,
    priority: { type: String, enum: ['HOT', 'WARM', 'REVIEW', 'LOW'] },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    line1: String,
    line2: String,
    locality: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    latitude: Number,
    longitude: Number,
    normalizedKey: String,
  },
  { _id: false },
);

const BusinessSchema = new Schema(
  {
    name: { type: String, required: true },
    canonicalName: { type: String, required: true },
    normalizedName: { type: String, required: true, index: true },
    category: { type: String, index: true },
    subcategory: String,
    address: AddressSchema,
    locality: String,
    city: { type: String, index: true },
    state: String,
    postalCode: String,
    country: String,
    location: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    operationalStatus: {
      type: String,
      enum: ['UNKNOWN', 'OPEN', 'CLOSED', 'TEMPORARILY_CLOSED'],
      default: 'UNKNOWN',
    },
    primaryWebsiteId: { type: Schema.Types.ObjectId, ref: 'Website', index: true },
    primaryContactIds: [{ type: Schema.Types.ObjectId, ref: 'Contact' }],
    currentScores: CurrentScoresSchema,
    dataQualityGrade: { type: String, enum: ['A', 'B', 'C', 'D'], index: true },
    searchJobIds: [{ type: Schema.Types.ObjectId, ref: 'SearchJob', index: true }],
    discoveredAt: { type: Date, default: Date.now },
    lastVerifiedAt: Date,
  },
  { timestamps: true, collection: 'businesses' },
);

BusinessSchema.index({ 'currentScores.salesOpportunity': -1 });
BusinessSchema.index({ 'currentScores.websiteHealth': -1 });
BusinessSchema.index({ 'currentScores.contactConfidence': -1 });
BusinessSchema.index({ city: 1, category: 1 });
BusinessSchema.index({ location: '2dsphere' }, { sparse: true });

export type BusinessDocument = InferSchemaType<typeof BusinessSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const BusinessModel: Model<BusinessDocument> =
  (models.Business as Model<BusinessDocument>) ||
  model<BusinessDocument>('Business', BusinessSchema);
