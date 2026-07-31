import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const WebsiteSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    url: { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    domain: { type: String, required: true, index: true },
    verificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'VERIFIED', 'LIKELY', 'UNCERTAIN', 'INVALID'],
      default: 'UNVERIFIED',
      index: true,
    },
    confidence: { type: Number, default: 0 },
    status: { type: String, default: 'UNKNOWN' },
    isPrimary: { type: Boolean, default: false },
    firstObservedAt: { type: Date, default: Date.now },
    lastVerifiedAt: Date,
  },
  { timestamps: true, collection: 'websites' },
);

WebsiteSchema.index({ businessId: 1, domain: 1 });

export type WebsiteDocument = InferSchemaType<typeof WebsiteSchema> & {
  _id: Types.ObjectId;
};

export const WebsiteModel: Model<WebsiteDocument> =
  (models.Website as Model<WebsiteDocument>) || model<WebsiteDocument>('Website', WebsiteSchema);
