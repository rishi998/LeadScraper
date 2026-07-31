import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const BusinessAliasSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    alias: { type: String, required: true },
    normalizedAlias: { type: String, required: true, index: true },
    source: String,
  },
  { timestamps: true, collection: 'business_aliases' },
);

export type BusinessAliasDocument = InferSchemaType<typeof BusinessAliasSchema> & {
  _id: Types.ObjectId;
};

export const BusinessAliasModel: Model<BusinessAliasDocument> =
  (models.BusinessAlias as Model<BusinessAliasDocument>) ||
  model<BusinessAliasDocument>('BusinessAlias', BusinessAliasSchema);
