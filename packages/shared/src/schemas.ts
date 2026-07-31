import { z } from 'zod';

export const searchJobCreateSchema = z.object({
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional(),
  country: z.string().min(1).max(120),
  localities: z.array(z.string().min(1).max(120)).default([]),
  categories: z.array(z.string().min(1).max(120)).min(1),
  categoryAliases: z.record(z.string(), z.array(z.string())).default({}),
  targetLeadCount: z.number().int().min(1).max(100_000).default(100),
  minimumOpportunityScore: z.number().int().min(0).max(100).default(60),
  enablePremiumEnrichment: z.boolean().default(false),
  enableAIAnalysis: z.boolean().default(false),
});

export type SearchJobCreateInput = z.infer<typeof searchJobCreateSchema>;

export const businessSearchInputSchema = z.object({
  city: z.string(),
  state: z.string().optional(),
  country: z.string(),
  locality: z.string().optional(),
  category: z.string(),
  categoryAlias: z.string().optional(),
  queryText: z.string(),
});

export type BusinessSearchInput = z.infer<typeof businessSearchInputSchema>;

export const providerStoragePolicySchema = z.object({
  providerId: z.string(),
  allowPersistRawPayload: z.boolean(),
  allowPersistFields: z.array(z.string()),
  allowExportFields: z.array(z.string()),
  retentionDays: z.number().int().positive().nullable(),
  notes: z.string().optional(),
});

export type ProviderStoragePolicy = z.infer<typeof providerStoragePolicySchema>;

export const businessCandidateSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  address: z
    .object({
      line1: z.string().optional(),
      locality: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  operationalStatus: z
    .enum(['UNKNOWN', 'OPEN', 'CLOSED', 'TEMPORARILY_CLOSED'])
    .default('UNKNOWN'),
  queryText: z.string(),
  raw: z.record(z.unknown()).optional(),
});

export type BusinessCandidate = z.infer<typeof businessCandidateSchema>;

export const aiInsightSchema = z.object({
  primaryProblem: z.string().min(1),
  businessImpact: z.string().min(1),
  recommendedService: z.string().min(1),
  secondaryService: z.string().optional(),
  whyContact: z.string().min(1),
  openingPitch: z.string().min(1),
});

export type AiInsightOutput = z.infer<typeof aiInsightSchema>;

/** MongoDB ObjectId string (24 hex chars). */
export const mongoObjectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

export const exportCreateSchema = z.object({
  searchJobId: mongoObjectIdSchema.optional(),
  filters: z
    .object({
      city: z.string().optional(),
      category: z.string().optional(),
      priority: z.enum(['HOT', 'WARM', 'REVIEW', 'LOW']).optional(),
      dataQualityGrade: z.enum(['A', 'B', 'C', 'D']).optional(),
      minWebsiteHealth: z.number().min(0).max(100).optional(),
      minSalesOpportunity: z.number().min(0).max(100).optional(),
      minContactConfidence: z.number().min(0).max(100).optional(),
    })
    .default({}),
});

export type ExportCreateInput = z.infer<typeof exportCreateSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
