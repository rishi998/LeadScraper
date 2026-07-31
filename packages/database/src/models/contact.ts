import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const ContactSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    type: {
      type: String,
      enum: ['PHONE', 'EMAIL', 'WHATSAPP', 'CONTACT_FORM'],
      required: true,
      index: true,
    },
    value: { type: String, required: true },
    normalizedValue: { type: String, required: true, index: true },
    rawValue: String,
    context: String,
    role: String,
    sourceType: String,
    source: String,
    sourceUrl: String,
    confidence: { type: Number, default: 0, index: true },
    verificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'CONFIRMED', 'LIKELY', 'REJECTED'],
      default: 'UNVERIFIED',
    },
    isPrimary: { type: Boolean, default: false },
    doNotContact: { type: Boolean, default: false },
    optOutDate: Date,
    jurisdiction: String,
    consentBasis: String,
    observedAt: { type: Date, default: Date.now },
    verifiedAt: Date,
  },
  { timestamps: true, collection: 'contacts' },
);

ContactSchema.index({ businessId: 1, type: 1, normalizedValue: 1 }, { unique: true });

export type ContactDocument = InferSchemaType<typeof ContactSchema> & {
  _id: Types.ObjectId;
};

export const ContactModel: Model<ContactDocument> =
  (models.Contact as Model<ContactDocument>) || model<ContactDocument>('Contact', ContactSchema);
