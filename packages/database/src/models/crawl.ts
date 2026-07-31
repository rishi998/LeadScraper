import { Schema, model, models, type InferSchemaType, type Model, Types } from 'mongoose';

const CrawlRunSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    pagesAttempted: { type: Number, default: 0 },
    pagesSucceeded: { type: Number, default: 0 },
    usedBrowser: { type: Boolean, default: false },
    robotsAllowed: Boolean,
    errorMessage: String,
    metadata: Schema.Types.Mixed,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, collection: 'crawl_runs' },
);

export type CrawlRunDocument = InferSchemaType<typeof CrawlRunSchema> & {
  _id: Types.ObjectId;
};

export const CrawlRunModel: Model<CrawlRunDocument> =
  (models.CrawlRun as Model<CrawlRunDocument>) || model<CrawlRunDocument>('CrawlRun', CrawlRunSchema);

const CrawlPageSchema = new Schema(
  {
    crawlRunId: { type: Schema.Types.ObjectId, ref: 'CrawlRun', required: true, index: true },
    url: { type: String, required: true },
    finalUrl: String,
    statusCode: Number,
    contentType: String,
    title: String,
    htmlHash: String,
    extractedText: String,
    htmlSnippet: String,
    headers: Schema.Types.Mixed,
    fetchMethod: { type: String, enum: ['HTTP', 'PLAYWRIGHT'], default: 'HTTP' },
    errorMessage: String,
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'crawl_pages' },
);

export type CrawlPageDocument = InferSchemaType<typeof CrawlPageSchema> & {
  _id: Types.ObjectId;
};

export const CrawlPageModel: Model<CrawlPageDocument> =
  (models.CrawlPage as Model<CrawlPageDocument>) ||
  model<CrawlPageDocument>('CrawlPage', CrawlPageSchema);
