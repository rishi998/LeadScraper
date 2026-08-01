import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createPerformanceProvider,
  performanceReportToMetrics,
  runFullAudits,
} from '@leadintel/audit';
import { extractContactsFromHtml, selectPrimaryContacts } from '@leadintel/contacts';
import {
  fetchVerificationSample,
  loadCrawlerOptionsFromEnv,
  shouldUseBrowser,
  verifyWebsite,
  type VerificationSample,
} from '@leadintel/crawler';
import {
  BusinessAliasModel,
  BusinessModel,
  ContactModel,
  CrawlPageModel,
  CrawlRunModel,
  AuditRunModel,
  EvidenceModel,
  ExportRunModel,
  RecommendationModel,
  ScoreModel,
  SearchJobModel,
  SourceModel,
  TechnologyModel,
  WebsiteModel,
  idString,
} from '@leadintel/database';
import { expandDiscoveryQueries } from '@leadintel/discovery';
import { clusterDuplicates, type EntityRecord } from '@leadintel/entity-resolution';
import { buildWorkbook, type ExcelContactRow, type ExcelLeadRow } from '@leadintel/excel';
import { buildRuleBasedNarrative, generateRecommendations } from '@leadintel/intelligence';
import type { JobQueue } from '@leadintel/job-queue';
import { createDiscoveryProvider } from '@leadintel/providers';
import { scoreLead } from '@leadintel/scoring';
import {
  AUTO_QUALIFY_WEBSITE_CONFIDENCE,
  ContactType,
  JobStatus,
  OperationalStatus,
  ProcessingJobType,
  SourceType,
  VerificationStatus,
  WebsiteVerificationStatus,
  extractDomain,
  freshnessScore,
  isFresh,
  normalizeAddressKey,
  normalizeBusinessName,
  normalizePhone,
  normalizeUrl,
} from '@leadintel/shared';
import { createTechnologyProvider, marketingDetectionSummary } from '@leadintel/technology';
import { Types } from 'mongoose';
import pino from 'pino';
import { resolveExportDir } from './export-paths';
import { fixtureHtmlForBusiness } from './fixtures';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function updateProgress(
  searchJobId: string,
  patch: Record<string, unknown> & {
    currentStage?: string;
    totalCandidates?: number;
    totalBusinesses?: number;
    processedBusinesses?: number;
    successfulBusinesses?: number;
    failedBusinesses?: number;
    progressPercent?: number;
  },
) {
  const job = await SearchJobModel.findById(searchJobId);
  if (!job) return;
  const progress = { ...(job.progress as Record<string, unknown>), ...patch };
  const total = patch.totalBusinesses ?? job.totalBusinesses ?? 0;
  const processed = patch.processedBusinesses ?? job.processedBusinesses ?? 0;
  const progressPercent =
    patch.progressPercent ??
    (total > 0 ? Math.min(100, Math.round((processed / total) * 1000) / 10) : job.progressPercent);

  await SearchJobModel.findByIdAndUpdate(searchJobId, {
    $set: {
      progress,
      ...(patch.totalCandidates != null ? { totalCandidates: patch.totalCandidates } : {}),
      ...(patch.totalBusinesses != null ? { totalBusinesses: patch.totalBusinesses } : {}),
      ...(patch.processedBusinesses != null ? { processedBusinesses: patch.processedBusinesses } : {}),
      ...(patch.successfulBusinesses != null
        ? { successfulBusinesses: patch.successfulBusinesses }
        : {}),
      ...(patch.failedBusinesses != null ? { failedBusinesses: patch.failedBusinesses } : {}),
      ...(patch.currentStage != null ? { currentStage: patch.currentStage } : {}),
      progressPercent,
    },
  });
}

export async function processDiscovery(
  data: { searchJobId: string },
  jobQueue: JobQueue,
) {
  const started = Date.now();
  const { searchJobId } = data;
  try {
    logger.info({ searchJobId, stage: 'DISCOVERY', status: 'RUNNING' }, 'stage');
    const searchJob = await SearchJobModel.findById(searchJobId);
    if (!searchJob) throw new Error(`SearchJob ${searchJobId} not found`);

    await SearchJobModel.findByIdAndUpdate(searchJobId, {
      $set: {
        status: JobStatus.RUNNING,
        startedAt: searchJob.startedAt ?? new Date(),
        tierReached: 1,
        currentStage: 'DISCOVERY',
      },
    });

    const provider = createDiscoveryProvider();
    const input = {
      city: searchJob.city,
      state: searchJob.state ?? undefined,
      country: searchJob.country,
      localities: searchJob.localities ?? [],
      categories: searchJob.categories,
      categoryAliases: (searchJob.categoryAliases as Record<string, string[]>) ?? {},
      targetLeadCount: searchJob.targetLeadCount,
      minimumOpportunityScore: searchJob.minimumOpportunityScore,
      enablePremiumEnrichment: searchJob.enablePremiumEnrichment,
      enableAIAnalysis: searchJob.enableAIAnalysis,
    };

    const expanded = expandDiscoveryQueries(input);
    const discoveryQueries: Array<{
      _id: Types.ObjectId;
      city?: string;
      locality?: string;
      category?: string;
      categoryAlias?: string;
      queryText: string;
      providerId: string;
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
      resultCount: number;
    }> = expanded.map((q) => ({
      _id: new Types.ObjectId(),
      city: q.city,
      locality: q.locality,
      category: q.category,
      categoryAlias: q.categoryAlias,
      queryText: q.queryText,
      providerId: provider.id,
      status: 'PENDING',
      resultCount: 0,
    }));
    await SearchJobModel.findByIdAndUpdate(searchJobId, { $set: { discoveryQueries } });

    let candidateCount = 0;
    let queryFailures = 0;

    for (const query of expanded) {
      const dq = discoveryQueries.find((d) => d.queryText === query.queryText);
      if (dq) dq.status = 'RUNNING';

      try {
        const candidates = await provider.search({
          city: query.city,
          state: input.state,
          country: input.country,
          locality: query.locality,
          category: query.category,
          categoryAlias: query.categoryAlias,
          queryText: query.queryText,
        });

        if (dq) {
          dq.status = 'COMPLETED';
          dq.resultCount = candidates.length;
        }

        for (const candidate of candidates) {
          candidateCount += 1;
          const normalizedName = normalizeBusinessName(candidate.name);
          const websiteUrl = candidate.website ? normalizeUrl(candidate.website) : null;
          const domain = websiteUrl ? extractDomain(websiteUrl) : null;
          const phone = candidate.phone ? normalizePhone(candidate.phone) : null;

          // Exact-signal entity check before create
          let existing: { _id: Types.ObjectId } | null = null;
          if (domain) {
            const site = await WebsiteModel.findOne({ domain }).lean();
            if (site) existing = await BusinessModel.findById(site.businessId).select('_id').lean();
          }
          if (!existing && phone) {
            const contact = await ContactModel.findOne({
              type: ContactType.PHONE,
              normalizedValue: phone,
            }).lean();
            if (contact) {
              existing = await BusinessModel.findById(contact.businessId).select('_id').lean();
            }
          }

          if (existing) {
            await SearchJobModel.findByIdAndUpdate(searchJobId, {
              $addToSet: { businessIds: existing._id },
            });
            await BusinessModel.findByIdAndUpdate(existing._id, {
              $addToSet: { searchJobIds: new Types.ObjectId(searchJobId) },
            });
            await SourceModel.create({
              businessId: existing._id,
              searchJobId: new Types.ObjectId(searchJobId),
              providerId: provider.id,
              externalId: candidate.externalId,
              queryText: candidate.queryText,
              rawPayload: provider.storagePolicy.allowPersistRawPayload ? candidate.raw : undefined,
              storagePolicy: provider.storagePolicy,
            });
            continue;
          }

          const business = await BusinessModel.create({
            name: candidate.name,
            canonicalName: candidate.name,
            normalizedName,
            category: candidate.category,
            subcategory: candidate.subcategory,
            address: candidate.address
              ? {
                  line1: candidate.address.line1,
                  locality: candidate.address.locality,
                  city: candidate.address.city ?? searchJob.city,
                  state: candidate.address.state ?? searchJob.state,
                  postalCode: candidate.address.postalCode,
                  country: candidate.address.country ?? searchJob.country,
                  latitude: candidate.address.latitude,
                  longitude: candidate.address.longitude,
                  normalizedKey: normalizeAddressKey(candidate.address),
                }
              : undefined,
            locality: candidate.address?.locality,
            city: candidate.address?.city ?? searchJob.city,
            state: candidate.address?.state ?? searchJob.state,
            postalCode: candidate.address?.postalCode,
            country: candidate.address?.country ?? searchJob.country,
            location:
              candidate.address?.latitude != null && candidate.address?.longitude != null
                ? {
                    type: 'Point',
                    coordinates: [candidate.address.longitude, candidate.address.latitude],
                  }
                : undefined,
            operationalStatus: candidate.operationalStatus ?? OperationalStatus.UNKNOWN,
            searchJobIds: [new Types.ObjectId(searchJobId)],
            discoveredAt: new Date(),
          });

          await SearchJobModel.findByIdAndUpdate(searchJobId, {
            $addToSet: { businessIds: business._id },
          });

          await BusinessAliasModel.create({
            businessId: business._id,
            alias: candidate.name,
            normalizedAlias: normalizedName,
            source: provider.id,
          });

          if (websiteUrl && domain) {
            const website = await WebsiteModel.create({
              businessId: business._id,
              url: websiteUrl,
              normalizedUrl: websiteUrl,
              domain,
              isPrimary: true,
              verificationStatus: WebsiteVerificationStatus.UNVERIFIED,
            });
            await BusinessModel.findByIdAndUpdate(business._id, {
              primaryWebsiteId: website._id,
            });
          }

          if (phone) {
            const contact = await ContactModel.create({
              businessId: business._id,
              type: ContactType.PHONE,
              value: phone,
              normalizedValue: phone,
              rawValue: candidate.phone,
              confidence: 0.85,
              verificationStatus: VerificationStatus.LIKELY,
              source: provider.id,
              sourceType: 'DISCOVERY_PROVIDER',
              isPrimary: true,
              verifiedAt: new Date(),
            });
            await BusinessModel.findByIdAndUpdate(business._id, {
              primaryContactIds: [contact._id],
            });
          }

          await SourceModel.create({
            businessId: business._id,
            searchJobId: new Types.ObjectId(searchJobId),
            providerId: provider.id,
            externalId: candidate.externalId,
            queryText: candidate.queryText,
            rawPayload: provider.storagePolicy.allowPersistRawPayload ? candidate.raw : undefined,
            storagePolicy: provider.storagePolicy,
          });
        }
      } catch (err) {
        queryFailures += 1;
        if (dq) dq.status = 'FAILED';
        const queryError = err instanceof Error ? err.message : String(err);
        logger.error(
          { searchJobId, query: query.queryText, error: queryError },
          'discovery query failed',
        );
      }

      await SearchJobModel.findByIdAndUpdate(searchJobId, {
        $set: { discoveryQueries, totalCandidates: candidateCount },
      });
    }

    if (candidateCount === 0) {
      throw new Error(
        queryFailures > 0
          ? `Discovery failed: ${queryFailures} query(s) failed with no leads saved`
          : 'Discovery returned no leads',
      );
    }

    if (queryFailures > 0) {
      await SearchJobModel.findByIdAndUpdate(searchJobId, {
        $set: {
          errorMessage: `${queryFailures} discovery query(s) failed; continuing with ${candidateCount} lead(s)`,
        },
      });
    }

    await SearchJobModel.findByIdAndUpdate(searchJobId, {
      $set: { discoveryQueries, totalCandidates: candidateCount },
    });

    await updateProgress(searchJobId, {
      discoveryCandidates: candidateCount,
      totalCandidates: candidateCount,
      currentStage: 'ENTITY_RESOLUTION',
    });

    await jobQueue.enqueue({
      type: ProcessingJobType.ENTITY_RESOLUTION,
      searchJobId,
      payload: { searchJobId },
      priority: 90,
    });

    logger.info(
      { searchJobId, stage: 'DISCOVERY', status: 'COMPLETED', duration: Date.now() - started },
      'stage',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizeSearchJobFailure(searchJobId, message);
    throw err;
  }
}

export async function processEntityResolution(
  data: { searchJobId: string },
  jobQueue: JobQueue,
) {
  const { searchJobId } = data;
  const started = Date.now();
  await updateProgress(searchJobId, { currentStage: 'ENTITY_RESOLUTION' });

  const searchJob = await SearchJobModel.findById(searchJobId).lean();
  if (!searchJob) throw new Error('Search job not found');

  const businesses = await BusinessModel.find({
    _id: { $in: searchJob.businessIds ?? [] },
  }).lean();

  const websites = await WebsiteModel.find({
    businessId: { $in: businesses.map((b) => b._id) },
  }).lean();
  const phones = await ContactModel.find({
    businessId: { $in: businesses.map((b) => b._id) },
    type: ContactType.PHONE,
  }).lean();

  const records: EntityRecord[] = businesses.map((b) => {
    const site = websites.find((w) => idString(w.businessId) === idString(b._id));
    const phone = phones.find((c) => idString(c.businessId) === idString(b._id));
    return {
      id: idString(b._id),
      name: b.canonicalName ?? b.name,
      phone: phone?.normalizedValue,
      website: site?.url,
      address: b.address,
    };
  });

  const clusters = clusterDuplicates(records);
  const survivors = new Set<string>();

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      survivors.add(cluster[0]!);
      continue;
    }
    const sorted = cluster
      .map((id) => businesses.find((b) => idString(b._id) === id)!)
      .sort(
        (a, b) =>
          new Date(a.discoveredAt ?? a.createdAt ?? 0).getTime() -
          new Date(b.discoveredAt ?? b.createdAt ?? 0).getTime(),
      );
    const survivor = sorted[0]!;
    survivors.add(idString(survivor._id));

    for (const dup of sorted.slice(1)) {
      await SourceModel.updateMany({ businessId: dup._id }, { businessId: survivor._id });
      await EvidenceModel.updateMany({ businessId: dup._id }, { businessId: survivor._id });
      await BusinessAliasModel.updateMany({ businessId: dup._id }, { businessId: survivor._id });
      await ContactModel.updateMany({ businessId: dup._id }, { businessId: survivor._id });
      const dupSites = await WebsiteModel.find({ businessId: dup._id });
      for (const site of dupSites) {
        const exists = await WebsiteModel.findOne({
          businessId: survivor._id,
          domain: site.domain,
        });
        if (!exists) {
          site.businessId = survivor._id;
          await site.save();
        } else {
          await WebsiteModel.deleteOne({ _id: site._id });
        }
      }
      const jobsWithDup = await SearchJobModel.find({ businessIds: dup._id }).select('_id').lean();
      await SearchJobModel.updateMany(
        { businessIds: dup._id },
        { $pull: { businessIds: dup._id } },
      );
      if (jobsWithDup.length > 0) {
        await SearchJobModel.updateMany(
          { _id: { $in: jobsWithDup.map((job) => job._id) } },
          { $addToSet: { businessIds: survivor._id } },
        );
      }
      await BusinessModel.deleteOne({ _id: dup._id });
    }
  }

  const remaining = await BusinessModel.find({
    searchJobIds: new Types.ObjectId(searchJobId),
  }).lean();

  for (const b of remaining) {
    await jobQueue.enqueue({
      type: ProcessingJobType.WEBSITE_VERIFICATION,
      searchJobId,
      businessId: idString(b._id),
      payload: { searchJobId, businessId: idString(b._id) },
      priority: 80,
    });
  }

  await updateProgress(searchJobId, {
    totalBusinesses: remaining.length,
    currentStage: 'WEBSITE_VERIFICATION',
  });
  logger.info(
    {
      searchJobId,
      stage: 'ENTITY_RESOLUTION',
      status: 'COMPLETED',
      duration: Date.now() - started,
    },
    'stage',
  );
}

export async function processWebsiteVerification(
  data: { searchJobId: string; businessId: string },
  jobQueue: JobQueue,
) {
  const { searchJobId, businessId } = data;
  await updateProgress(searchJobId, { currentStage: 'WEBSITE_VERIFICATION' });

  const business = await BusinessModel.findById(businessId);
  if (!business) throw new Error('Business not found');
  const website =
    (business.primaryWebsiteId
      ? await WebsiteModel.findById(business.primaryWebsiteId)
      : null) ?? (await WebsiteModel.findOne({ businessId, isPrimary: true }));

  if (!website) {
    await jobQueue.enqueue({
      type: ProcessingJobType.SCORING,
      searchJobId,
      businessId,
      payload: { searchJobId, businessId },
      priority: 20,
    });
    return;
  }

  const phone = await ContactModel.findOne({ businessId, type: ContactType.PHONE });
  const isFixture = website.domain.endsWith('.example.com');
  const html = isFixture
    ? fixtureHtmlForBusiness(business.canonicalName, phone?.value, website.domain)
    : '';

  let sample: VerificationSample | null = null;
  if (!isFixture) {
    try {
      sample = await fetchVerificationSample(website.url, loadCrawlerOptionsFromEnv());
    } catch (err) {
      logger.warn(
        {
          searchJobId,
          businessId,
          url: website.url,
          error: err instanceof Error ? err.message : String(err),
        },
        'website verification fetch failed',
      );
    }
  }

  const result = verifyWebsite({
    businessName: business.canonicalName,
    websiteUrl: website.url,
    phone: phone?.value,
    city: business.city,
    pageTitle: isFixture ? `${business.canonicalName} | Official Site` : sample?.title,
    pageText: isFixture ? html : sample?.text,
  });

  const status = isFixture
    ? WebsiteVerificationStatus.LIKELY
    : (result.status as WebsiteVerificationStatus);
  const confidence = isFixture ? Math.max(result.confidence, 0.8) : result.confidence;

  await WebsiteModel.findByIdAndUpdate(website._id, {
    verificationStatus: status,
    confidence,
    status: sample ? (sample.reachable ? 'REACHABLE' : 'UNREACHABLE') : isFixture ? 'REACHABLE' : 'UNREACHABLE',
    lastVerifiedAt: new Date(),
  });

  await EvidenceModel.create({
    businessId,
    websiteId: website._id,
    field: 'website',
    value: website.url,
    sourceType: SourceType.SYSTEM,
    sourceUrl: website.url,
    method: 'WEBSITE_VERIFICATION',
    confidence,
    verificationStatus:
      status === WebsiteVerificationStatus.VERIFIED
        ? VerificationStatus.CONFIRMED
        : VerificationStatus.LIKELY,
    metadata: {
      reasons: result.reasons,
      status,
      httpStatus: sample?.statusCode ?? null,
    },
  });

  // Verification can only match signals the HTTP body actually contained, so a JS shell
  // is undecidable here; defer it to the crawler, which falls back to a real browser.
  const undecidable = Boolean(sample?.reachable && shouldUseBrowser(sample.html, sample.statusCode));
  const qualify =
    status === WebsiteVerificationStatus.VERIFIED ||
    status === WebsiteVerificationStatus.LIKELY ||
    undecidable;

  logger.info(
    {
      searchJobId,
      businessId,
      domain: website.domain,
      status,
      confidence: Math.round(confidence * 100) / 100,
      reasons: result.reasons,
      httpStatus: sample?.statusCode ?? null,
      needsManualReview: !(
        status === WebsiteVerificationStatus.VERIFIED ||
        (status === WebsiteVerificationStatus.LIKELY &&
          confidence >= AUTO_QUALIFY_WEBSITE_CONFIDENCE)
      ),
      qualify,
    },
    'website verification',
  );

  if (qualify) {
    await jobQueue.enqueue({
      type: ProcessingJobType.CRAWL,
      searchJobId,
      businessId,
      payload: {
        searchJobId,
        businessId,
        websiteId: idString(website._id),
        domain: website.domain,
        websiteUrl: website.url,
      },
      priority: 70,
    });
  } else {
    await jobQueue.enqueue({
      type: ProcessingJobType.SCORING,
      searchJobId,
      businessId,
      payload: { searchJobId, businessId },
      priority: 20,
    });
  }
}

export async function processCrawl(
  data: { searchJobId: string; businessId: string; websiteId: string },
  jobQueue: JobQueue,
) {
  const { searchJobId, businessId, websiteId } = data;
  await updateProgress(searchJobId, { currentStage: 'CRAWL' });

  const website = await WebsiteModel.findById(websiteId);
  const business = await BusinessModel.findById(businessId);
  if (!website || !business) throw new Error('Website/business not found');

  const prior = await CrawlRunModel.findOne({
    businessId,
    websiteId,
    status: 'COMPLETED',
  }).sort({ completedAt: -1 });
  if (prior?.completedAt && isFresh(prior.completedAt, 'crawl')) {
    logger.info(
      { searchJobId, businessId, crawlRunId: idString(prior._id) },
      'skipping crawl — fresh crawl artifact',
    );
    await jobQueue.enqueue({
      type: ProcessingJobType.CONTACT_EXTRACTION,
      searchJobId,
      businessId,
      payload: { searchJobId, businessId, crawlRunId: idString(prior._id) },
      priority: 60,
    });
    return;
  }

  const crawlRun = await CrawlRunModel.create({
    businessId,
    websiteId,
    status: 'RUNNING',
    startedAt: new Date(),
  });

  try {
    const isFixture = website.domain.endsWith('.example.com');
    const phone = await ContactModel.findOne({ businessId, type: ContactType.PHONE });
    let pages: Array<{
      url: string;
      finalUrl: string;
      statusCode: number;
      title?: string;
      htmlHash: string;
      extractedText: string;
      htmlSnippet: string;
      headers: Record<string, string>;
      fetchMethod?: 'HTTP' | 'PLAYWRIGHT';
    }>;
    let robotsAllowed: boolean | null = true;
    let usedBrowser = false;
    let hasSitemap = false;

    if (isFixture) {
      const html = fixtureHtmlForBusiness(business.canonicalName, phone?.value, website.domain);
      pages = [
        {
          url: website.url,
          finalUrl: website.url,
          statusCode: 200,
          title: `${business.canonicalName} | Official Site`,
          htmlHash: 'fixture-home',
          extractedText: business.canonicalName,
          htmlSnippet: html,
          headers: {
            'content-type': 'text/html',
            'strict-transport-security': 'max-age=31536000',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
          },
          fetchMethod: 'HTTP',
        },
        {
          url: `${website.url.replace(/\/$/, '')}/contact`,
          finalUrl: `${website.url.replace(/\/$/, '')}/contact`,
          statusCode: 200,
          title: `Contact | ${business.canonicalName}`,
          htmlHash: 'fixture-contact',
          extractedText: 'contact',
          htmlSnippet: html.replace('<h1>', '<h1>Contact — '),
          headers: { 'content-type': 'text/html' },
          fetchMethod: 'HTTP',
        },
      ];
      hasSitemap = true;
    } else {
      const { crawlWebsite } = await import('@leadintel/crawler');
      const opts = loadCrawlerOptionsFromEnv();
      const result = await crawlWebsite(website.url, opts);
      robotsAllowed = result.robotsAllowed;
      usedBrowser = result.usedBrowser;
      hasSitemap = result.sitemapUrls.length > 0;
      pages = result.pages.map((p) => ({
        url: p.url,
        finalUrl: p.finalUrl,
        statusCode: p.statusCode,
        title: p.title,
        htmlHash: p.htmlHash,
        extractedText: p.extractedText,
        htmlSnippet: p.htmlSnippet,
        headers: p.headers,
        fetchMethod: p.fetchMethod ?? 'HTTP',
      }));
    }

    for (const page of pages) {
      await CrawlPageModel.create({
        crawlRunId: crawlRun._id,
        url: page.url,
        finalUrl: page.finalUrl,
        statusCode: page.statusCode,
        title: page.title,
        htmlHash: page.htmlHash,
        extractedText: page.extractedText,
        htmlSnippet: page.htmlSnippet.slice(0, 100_000),
        headers: page.headers,
        fetchMethod: page.fetchMethod ?? 'HTTP',
      });
    }

    await CrawlRunModel.findByIdAndUpdate(crawlRun._id, {
      status: 'COMPLETED',
      pagesAttempted: pages.length,
      pagesSucceeded: pages.filter((p) => p.statusCode >= 200 && p.statusCode < 400).length,
      completedAt: new Date(),
      robotsAllowed: robotsAllowed ?? undefined,
      usedBrowser,
      metadata: { hasSitemap },
    });

    await SearchJobModel.findByIdAndUpdate(searchJobId, { tierReached: 2 });
    await jobQueue.enqueue({
      type: ProcessingJobType.CONTACT_EXTRACTION,
      searchJobId,
      businessId,
      payload: { searchJobId, businessId, crawlRunId: idString(crawlRun._id) },
      priority: 60,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await CrawlRunModel.findByIdAndUpdate(crawlRun._id, {
      status: 'FAILED',
      errorMessage: message,
      completedAt: new Date(),
    });
    await jobQueue.enqueue({
      type: ProcessingJobType.SCORING,
      searchJobId,
      businessId,
      payload: { searchJobId, businessId },
      priority: 20,
    });
    throw err;
  }
}

export async function processContactExtraction(
  data: { searchJobId: string; businessId: string; crawlRunId: string },
  jobQueue: JobQueue,
) {
  const { searchJobId, businessId, crawlRunId } = data;
  await updateProgress(searchJobId, { currentStage: 'CONTACT_EXTRACTION' });

  const pages = await CrawlPageModel.find({ crawlRunId }).lean();
  const website = await WebsiteModel.findOne({ businessId, isPrimary: true }).lean();

  const all = pages.flatMap((p) =>
    extractContactsFromHtml({
      url: p.finalUrl ?? p.url,
      html: p.htmlSnippet ?? '',
      websiteDomain: website?.domain,
    }),
  );

  const map = new Map<string, (typeof all)[number]>();
  for (const c of all) {
    const key = `${c.type}:${c.value}`;
    const prev = map.get(key);
    if (!prev || c.confidence > prev.confidence) map.set(key, c);
  }

  const primaryIds: Types.ObjectId[] = [];
  for (const c of map.values()) {
    const type = c.type === ContactType.CONTACT_FORM || String(c.type) === 'FORM'
      ? ContactType.CONTACT_FORM
      : c.type;
    const doc = await ContactModel.findOneAndUpdate(
      { businessId, type, normalizedValue: c.value },
      {
        $set: {
          value: c.value,
          normalizedValue: c.value,
          rawValue: c.rawValue,
          context: c.context,
          confidence: c.confidence,
          verificationStatus: c.verificationStatus,
          source: c.source,
          sourceType: c.source,
          sourceUrl: c.sourceUrl,
          observedAt: new Date(),
        },
        $setOnInsert: { businessId, type },
      },
      { upsert: true, new: true },
    );

    await EvidenceModel.create({
      businessId,
      websiteId: website?._id,
      field: type.toLowerCase(),
      value: c.value,
      sourceType: SourceType.BUSINESS_WEBSITE,
      sourceUrl: c.sourceUrl,
      method: c.method,
      confidence: c.confidence,
      verificationStatus: c.verificationStatus,
    });
    void doc;
  }

  const primaries = selectPrimaryContacts([...map.values()]);
  await ContactModel.updateMany({ businessId }, { isPrimary: false });
  for (const p of primaries) {
    const type =
      p.type === ContactType.CONTACT_FORM || String(p.type) === 'FORM'
        ? ContactType.CONTACT_FORM
        : p.type;
    const updated = await ContactModel.findOneAndUpdate(
      { businessId, type, normalizedValue: p.value },
      { isPrimary: true, verifiedAt: new Date() },
      { new: true },
    );
    if (updated) primaryIds.push(updated._id);
  }
  await BusinessModel.findByIdAndUpdate(businessId, { primaryContactIds: primaryIds });

  await jobQueue.enqueue({
    type: ProcessingJobType.AUDIT,
    searchJobId,
    businessId,
    payload: { searchJobId, businessId, crawlRunId },
    priority: 50,
  });
}

export async function processAudit(
  data: { searchJobId: string; businessId: string; crawlRunId: string },
  jobQueue: JobQueue,
) {
  const { searchJobId, businessId, crawlRunId } = data;
  await updateProgress(searchJobId, { currentStage: 'AUDIT' });

  const crawlRun = await CrawlRunModel.findById(crawlRunId);
  if (!crawlRun) throw new Error('Crawl run not found');
  const pages = await CrawlPageModel.find({ crawlRunId }).lean();
  const website = await WebsiteModel.findById(crawlRun.websiteId).lean();
  if (!website) throw new Error('Website not found');

  const auditRun = await AuditRunModel.create({
    businessId,
    websiteId: crawlRun.websiteId,
    crawlRunId,
    status: 'RUNNING',
    startedAt: new Date(),
    version: process.env.SCORING_ALGORITHM_VERSION,
  });

  const hasSitemap = Boolean(
    (crawlRun.metadata as { hasSitemap?: boolean } | undefined)?.hasSitemap,
  );
  const modules = runFullAudits({
    websiteUrl: website.url,
    pages: pages.map((p) => ({
      url: p.url,
      finalUrl: p.finalUrl,
      statusCode: p.statusCode,
      htmlSnippet: p.htmlSnippet,
      title: p.title,
      headers: (p.headers as Record<string, string> | null) ?? {},
    })),
    robotsAllowed: crawlRun.robotsAllowed,
    hasSitemap,
  });

  const html = pages.map((p) => p.htmlSnippet ?? '').join('\n');
  const techProvider = createTechnologyProvider();
  let tech = [] as Awaited<ReturnType<typeof techProvider.analyze>>;
  const priorTech = await TechnologyModel.findOne({ businessId }).sort({ detectedAt: -1 });
  if (priorTech?.detectedAt && isFresh(priorTech.detectedAt, 'technology')) {
    tech = (await TechnologyModel.find({ businessId }).lean()).map((t) => ({
      name: t.name,
      category: t.category ?? 'unknown',
      confidence: t.confidence ?? 0,
      signal: t.signal ?? '',
      version: t.version ?? undefined,
    }));
    logger.info({ businessId }, 'reusing fresh technology detections');
  } else {
    tech = await techProvider.analyze(website.url, html);
    await TechnologyModel.deleteMany({ businessId });
    for (const t of tech) {
      await TechnologyModel.create({
        businessId,
        name: t.name,
        category: t.category,
        confidence: t.confidence,
        source: techProvider.id,
        version: t.version,
        signal: t.signal,
      });
    }
  }
  const marketing = marketingDetectionSummary(tech);

  const metricList: Array<{
    module: string;
    name: string;
    value?: number;
    valueText?: string;
    unit?: string;
    dataSource: string;
    confidence: number;
  }> = [];
  const findings: Array<{
    module: string;
    severity: string;
    code: string;
    message: string;
    evidenceId?: Types.ObjectId;
  }> = [];
  const scores: Record<string, number | null> = {};
  const metricsNested: Record<string, Record<string, unknown>> = {};

  for (const mod of modules) {
    const key =
      mod.module === 'MOBILE_UX'
        ? 'mobileUx'
        : mod.module === 'ACCESSIBILITY'
          ? 'accessibility'
          : mod.module.toLowerCase();
    scores[key] = mod.score;
    metricsNested[key] = {};
    for (const metric of mod.metrics) {
      metricList.push({ ...metric });
      metricsNested[key]![metric.name] = metric.value ?? metric.valueText;
    }
    for (const finding of mod.findings) {
      let evidenceId: Types.ObjectId | undefined;
      if (finding.evidence) {
        const ev = await EvidenceModel.create({
          businessId,
          websiteId: website._id,
          auditRunId: auditRun._id,
          field: finding.evidence.field,
          value: finding.evidence.value,
          sourceType: SourceType.BUSINESS_WEBSITE,
          sourceUrl: finding.evidence.sourceUrl,
          method: finding.evidence.method,
          confidence: 0.9,
          verificationStatus: VerificationStatus.CONFIRMED,
        });
        evidenceId = ev._id;
      }
      findings.push({
        module: finding.module,
        severity: finding.severity,
        code: finding.code,
        message: finding.message,
        evidenceId,
      });
    }
  }

  // Performance: skip expensive provider when a fresh lab report exists on prior audit
  const priorPerfAudit = await AuditRunModel.findOne({
    businessId,
    status: 'COMPLETED',
    'scores.performance': { $ne: null },
  }).sort({ completedAt: -1 });
  let performanceScore: number | null = null;
  if (priorPerfAudit?.completedAt && isFresh(priorPerfAudit.completedAt, 'performance')) {
    performanceScore = priorPerfAudit.scores?.performance ?? null;
    metricsNested.performance = (priorPerfAudit.metrics as { performance?: Record<string, unknown> })
      ?.performance ?? { reused: true };
    const priorList = [...(priorPerfAudit.metricList ?? [])]
      .filter((m) => m.module === 'PERFORMANCE')
      .map((m) => ({
        module: String(m.module ?? 'PERFORMANCE'),
        name: String(m.name ?? ''),
        value: m.value ?? undefined,
        valueText: m.valueText ?? undefined,
        unit: m.unit ?? undefined,
        dataSource: String(m.dataSource ?? 'LAB'),
        confidence: m.confidence ?? 0.8,
      }));
    metricList.push(...priorList);
    logger.info({ businessId }, 'reusing fresh performance lab metrics');
  } else {
    const perfProvider = createPerformanceProvider();
    const report = await perfProvider.measure(website.url);
    performanceScore = report.performanceScore;
    scores.performance = performanceScore;
    metricsNested.performance = {
      provider: report.provider,
      dataSource: report.dataSource,
      lcpMs: report.lcpMs,
      cls: report.cls,
      tbtMs: report.tbtMs,
      fcpMs: report.fcpMs,
      notes: report.notes,
      performanceScore: report.performanceScore,
    };
    metricList.push(...performanceReportToMetrics(report));
  }

  metricsNested.marketing = marketing;
  for (const [name, valueText] of Object.entries(marketing)) {
    metricList.push({
      module: 'MARKETING',
      name,
      valueText,
      dataSource: 'STATIC',
      confidence: 0.85,
    });
  }

  const modulesComplete = modules.filter((m) => m.score != null).length + (performanceScore != null ? 1 : 0);
  const runConfidence =
    modules.reduce((s, m) => s + m.confidence, 0) / Math.max(1, modules.length);

  await AuditRunModel.findByIdAndUpdate(auditRun._id, {
    status: 'COMPLETED',
    completedAt: new Date(),
    confidence: runConfidence,
    scores: {
      seo: scores.seo ?? undefined,
      security: scores.security ?? undefined,
      conversion: scores.conversion ?? undefined,
      technical: scores.technical ?? undefined,
      performance: performanceScore ?? scores.performance ?? undefined,
      accessibility: scores.accessibility ?? undefined,
      mobileUx: scores.mobileUx ?? undefined,
    },
    metrics: metricsNested,
    metricList,
    findings,
    findingsSummary: {
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      major: findings.filter((f) => f.severity === 'MAJOR').length,
      minor: findings.filter((f) => f.severity === 'MINOR').length,
    },
    metadata: { modulesComplete, modulesExpected: 7 },
  });

  await jobQueue.enqueue({
    type: ProcessingJobType.SCORING,
    searchJobId,
    businessId,
    payload: { searchJobId, businessId, auditRunId: idString(auditRun._id) },
    priority: 40,
  });
}

export async function processScoring(data: {
  searchJobId: string;
  businessId: string;
  auditRunId?: string;
}) {
  const { searchJobId, businessId, auditRunId } = data;
  await updateProgress(searchJobId, { currentStage: 'SCORING' });

  const business = await BusinessModel.findById(businessId);
  if (!business) throw new Error('Business not found');

  const website =
    (business.primaryWebsiteId
      ? await WebsiteModel.findById(business.primaryWebsiteId)
      : null) ?? (await WebsiteModel.findOne({ businessId, isPrimary: true }));

  const audit = auditRunId
    ? await AuditRunModel.findById(auditRunId)
    : await AuditRunModel.findOne({ businessId }).sort({ createdAt: -1 });

  const metric = (module: string, name: string) => {
    const list = (audit?.metricList ?? []) as Array<{ module?: string; name?: string; value?: number }>;
    return list.find((m) => m.module === module && m.name === name)?.value ?? null;
  };

  const seoScore = metric('SEO', 'technicalSEOScore');
  const conversionScore = metric('CONVERSION', 'conversionReadinessScore');
  const securityMetrics = ((audit?.metricList ?? []) as Array<{
    module?: string;
    name?: string;
    value?: number;
  }>).filter((m) => m.module === 'SECURITY' && m.value != null && m.name !== 'tlsValid');
  const securityScore =
    audit?.scores?.security ??
    (securityMetrics.length
      ? (securityMetrics.reduce((s, m) => s + (m.value ?? 0), 0) / securityMetrics.length) * 100
      : null);
  const statusCode = metric('TECHNICAL', 'statusCode');
  const technicalScore =
    audit?.scores?.technical ??
    (statusCode != null ? (statusCode >= 200 && statusCode < 400 ? 85 : 30) : null);
  const performanceScore = audit?.scores?.performance ?? metric('PERFORMANCE', 'performanceScore');
  const accessibilityScore =
    audit?.scores?.accessibility ?? metric('ACCESSIBILITY', 'accessibilityScore');
  const mobileUxScore = audit?.scores?.mobileUx ?? metric('MOBILE_UX', 'mobileUxScore');

  const primaryContacts = await ContactModel.find({ businessId, isPrimary: true });
  const allContacts = await ContactModel.find({ businessId });
  const contactConfidence = primaryContacts.length
    ? (primaryContacts.reduce((s, c) => s + c.confidence, 0) / primaryContacts.length) * 100
    : allContacts.length
      ? Math.max(...allContacts.map((c) => c.confidence)) * 100
      : null;

  const technologies = await TechnologyModel.find({ businessId });
  const analyticsDetected = technologies.some((t) =>
    ['Google Analytics', 'Google Tag Manager'].includes(t.name),
  );

  const crawlRun = audit?.crawlRunId
    ? await CrawlRunModel.findById(audit.crawlRunId)
    : await CrawlRunModel.findOne({ businessId }).sort({ completedAt: -1 });
  const pagesAttempted = crawlRun?.pagesAttempted ?? 0;
  const pagesSucceeded = crawlRun?.pagesSucceeded ?? 0;
  const crawlCoverage = pagesAttempted > 0 ? pagesSucceeded / pagesAttempted : audit ? 0.6 : 0.2;
  const modulesMeta = audit?.metadata as { modulesComplete?: number; modulesExpected?: number } | undefined;
  const fresh = freshnessScore(audit?.completedAt ?? crawlRun?.completedAt ?? null, 'performance');

  const result = scoreLead({
    dimensions: [
      { key: 'seo', score: seoScore ?? 0, reliable: seoScore != null },
      { key: 'security', score: securityScore ?? 0, reliable: securityScore != null },
      { key: 'conversion', score: conversionScore ?? 0, reliable: conversionScore != null },
      { key: 'technical', score: technicalScore ?? 0, reliable: technicalScore != null },
      { key: 'performance', score: performanceScore ?? 0, reliable: performanceScore != null },
      { key: 'accessibility', score: accessibilityScore ?? 0, reliable: accessibilityScore != null },
      { key: 'mobileUx', score: mobileUxScore ?? 0, reliable: mobileUxScore != null },
      { key: 'designUx', score: 0, reliable: false },
    ],
    conversionReadiness: conversionScore,
    marketingGap: analyticsDetected ? 30 : 70,
    contactConfidence,
    websiteVerification: website?.verificationStatus as never,
    hasWebsite: Boolean(website),
    websiteBroken: Boolean(website && (statusCode ?? 200) >= 400),
    operationalStatus: business.operationalStatus as never,
    crawlCoverage,
    auditModulesComplete: modulesMeta?.modulesComplete ?? (audit ? 6 : 0),
    auditModulesExpected: modulesMeta?.modulesExpected ?? 7,
    freshness: fresh,
    primaryContactVerified: primaryContacts.some(
      (c) =>
        c.verificationStatus === VerificationStatus.CONFIRMED ||
        c.verificationStatus === VerificationStatus.LIKELY,
    ),
  });

  const score = await ScoreModel.create({
    businessId,
    auditRunId: audit?._id,
    algorithmVersion: result.algorithmVersion,
    websiteHealth: result.websiteHealth,
    marketReadiness: result.marketReadiness,
    conversionReadiness: result.conversionReadiness,
    businessVitality: result.businessVitality,
    contactConfidence: result.contactConfidence,
    salesOpportunity: result.salesOpportunity,
    auditConfidence: result.auditConfidence,
    priority: result.priority,
    modifiers: result.modifiers,
    components: result.components,
    dataQualityGrade: result.dataQualityGrade,
  });

  const evidence = await EvidenceModel.find({ businessId }).limit(50).lean();
  const fallback =
    evidence[0]?._id?.toString() ??
    (
      await EvidenceModel.create({
        businessId,
        field: 'system',
        value: 'scoring',
        sourceType: SourceType.SYSTEM,
        method: 'SCORING',
        confidence: 1,
        verificationStatus: VerificationStatus.CONFIRMED,
      })
    )._id.toString();

  const evidenceIds = {
    vitality: [fallback],
    website: evidence.filter((e) => e.field === 'website').map((e) => idString(e._id)),
    websiteHealth: [fallback],
    conversion: [fallback],
    seo: [fallback],
    analytics: [fallback],
    performance: [fallback],
  };
  for (const key of Object.keys(evidenceIds) as (keyof typeof evidenceIds)[]) {
    if (evidenceIds[key].length === 0) evidenceIds[key] = [fallback];
  }

  const recommendations = generateRecommendations({
    hasWebsite: Boolean(website),
    websiteHealth: result.websiteHealth,
    conversionReadiness: result.conversionReadiness,
    businessVitality: result.businessVitality,
    technicalSeo: seoScore,
    performance: performanceScore,
    analyticsDetected,
    evidenceIds,
  });

  await RecommendationModel.deleteMany({ businessId });
  for (const rec of recommendations) {
    await RecommendationModel.create({
      businessId,
      scoreId: score._id,
      service: String(rec.service),
      priority: rec.priority,
      reason: rec.reason,
      evidenceIds: rec.evidenceIds,
      ruleId: rec.ruleId,
    });
  }

  const narrative = buildRuleBasedNarrative(business.canonicalName, recommendations);
  await ScoreModel.findByIdAndUpdate(score._id, {
    components: { ...result.components, narrative },
  });

  await BusinessModel.findByIdAndUpdate(businessId, {
    currentScores: {
      websiteHealth: result.websiteHealth,
      marketReadiness: result.marketReadiness,
      conversionReadiness: result.conversionReadiness,
      businessVitality: result.businessVitality,
      contactConfidence: result.contactConfidence,
      salesOpportunity: result.salesOpportunity,
      auditConfidence: result.auditConfidence,
      priority: result.priority,
    },
    dataQualityGrade: result.dataQualityGrade,
    lastVerifiedAt: new Date(),
  });

  await maybeCompleteSearchJob(searchJobId);
}

async function maybeCompleteSearchJob(searchJobId: string) {
  const searchJob = await SearchJobModel.findById(searchJobId).lean();
  if (!searchJob) return;
  const ids = searchJob.businessIds ?? [];
  const businesses = await BusinessModel.find({ _id: { $in: ids } }).lean();
  const scored = businesses.filter((b) => b.currentScores?.salesOpportunity != null).length;
  const failed = Math.max(0, businesses.length - scored);
  const progressPercent =
    businesses.length > 0 ? Math.min(100, (scored / businesses.length) * 100) : 100;

  await updateProgress(searchJobId, {
    totalBusinesses: businesses.length,
    processedBusinesses: scored,
    successfulBusinesses: scored,
    failedBusinesses: failed,
    progressPercent,
    currentStage: scored >= businesses.length && businesses.length > 0 ? 'COMPLETED' : 'SCORING',
  });

  if (scored >= businesses.length && businesses.length > 0) {
    await SearchJobModel.findByIdAndUpdate(searchJobId, {
      status: failed > 0 ? JobStatus.PARTIALLY_COMPLETED : JobStatus.COMPLETED,
      completedAt: new Date(),
      progressPercent: 100,
      currentStage: 'COMPLETED',
    });
  }
}

export async function processExport(data: { exportRunId: string }) {
  const { exportRunId } = data;
  const exportRun = await ExportRunModel.findById(exportRunId);
  if (!exportRun) throw new Error('Export run not found');

  await ExportRunModel.findByIdAndUpdate(exportRunId, {
    status: 'RUNNING',
    startedAt: new Date(),
  });

  try {
    const filter: Record<string, unknown> = {};
    if (exportRun.searchJobId) {
      filter.searchJobIds = exportRun.searchJobId;
    }
    const filters = (exportRun.filterSnapshot ?? {}) as Record<string, unknown>;
    if (filters.priority) filter['currentScores.priority'] = filters.priority;
    if (filters.category) filter.category = filters.category;
    if (filters.dataQualityGrade) filter.dataQualityGrade = filters.dataQualityGrade;
    if (filters.minSalesOpportunity != null) {
      filter['currentScores.salesOpportunity'] = { $gte: Number(filters.minSalesOpportunity) };
    }

    const businesses = await BusinessModel.find(filter)
      .sort({ 'currentScores.salesOpportunity': -1 })
      .lean();

    const leads: ExcelLeadRow[] = [];
    const contactsOut: ExcelContactRow[] = [];

    for (const b of businesses) {
      const leadId = idString(b._id);
      const website = await WebsiteModel.findOne({
        businessId: b._id,
        isPrimary: true,
      }).lean();
      const contacts = await ContactModel.find({ businessId: b._id }).lean();
      const recommendations = await RecommendationModel.find({ businessId: b._id })
        .sort({ priority: 1 })
        .lean();
      const score = await ScoreModel.findOne({ businessId: b._id }).sort({ scoredAt: -1 }).lean();
      const audit = await AuditRunModel.findOne({ businessId: b._id }).sort({ createdAt: -1 }).lean();
      const sources = await SourceModel.find({ businessId: b._id }).lean();
      const technologies = await TechnologyModel.find({ businessId: b._id }).lean();
      const narrative = (score?.components as { narrative?: Record<string, string> } | null)
        ?.narrative;

      const primaryPhone =
        contacts.find((c) => c.type === 'PHONE' && c.isPrimary) ??
        [...contacts]
          .filter((c) => c.type === 'PHONE')
          .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      const primaryEmail =
        contacts.find((c) => c.type === 'EMAIL' && c.isPrimary) ??
        [...contacts]
          .filter((c) => c.type === 'EMAIL')
          .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      const whatsapp =
        contacts.find((c) => c.type === 'WHATSAPP' && c.isPrimary) ??
        contacts.find((c) => c.type === 'WHATSAPP');

      const metricList = (audit?.metricList ?? []) as Array<{
        module?: string;
        name?: string;
        value?: number;
        valueText?: string;
      }>;
      const m = (module: string, name: string) =>
        metricList.find((x) => x.module === module && x.name === name);

      leads.push({
        leadId,
        priority: b.currentScores?.priority,
        dataQualityGrade: b.dataQualityGrade,
        businessName: b.canonicalName ?? b.name,
        category: b.category,
        subcategory: b.subcategory,
        city: b.city,
        locality: b.locality,
        state: b.state,
        postalCode: b.postalCode,
        country: b.country,
        address: [b.address?.line1, b.locality, b.city].filter(Boolean).join(', '),
        website: website?.url,
        websiteVerification: website?.verificationStatus,
        operationalStatus: b.operationalStatus,
        primaryPhone: primaryPhone?.doNotContact ? '[DO_NOT_CONTACT]' : primaryPhone?.value,
        whatsapp: whatsapp?.value,
        primaryEmail: primaryEmail?.doNotContact ? '[DO_NOT_CONTACT]' : primaryEmail?.value,
        websiteHealth: b.currentScores?.websiteHealth,
        marketReadiness: b.currentScores?.marketReadiness,
        conversionReadiness: b.currentScores?.conversionReadiness,
        businessVitality: b.currentScores?.businessVitality,
        contactConfidence: b.currentScores?.contactConfidence,
        salesOpportunity: b.currentScores?.salesOpportunity,
        auditConfidence: b.currentScores?.auditConfidence,
        primaryProblem: narrative?.primaryProblem,
        evidenceSummary: recommendations.map((r) => r.reason).join('; '),
        businessImpact: narrative?.businessImpact,
        recommendedService: recommendations[0]?.service ?? narrative?.recommendedService,
        secondaryService: recommendations[1]?.service ?? narrative?.secondaryService,
        whyContact: narrative?.whyContact,
        openingPitch: narrative?.openingPitch,
        lastVerified: b.lastVerifiedAt,
        discoverySource: sources.map((s) => s.providerId).join(', '),
        sourceIds: sources.map((s) => s.externalId).filter(Boolean).join(', '),
        discoveredAt: b.discoveredAt,
        doNotContact: contacts.some((c) => c.doNotContact),
        domain: website?.domain,
        websiteStatus: website?.verificationStatus,
        statusCode: m('TECHNICAL', 'statusCode')?.value ?? null,
        https: (m('SECURITY', 'https')?.value ?? 0) === 1,
        tlsValid: (m('SECURITY', 'tlsValid')?.value ?? 0) === 1,
        seo: m('SEO', 'technicalSEOScore')?.value ?? null,
        technicalSeo: m('SEO', 'technicalSEOScore')?.value ?? null,
        conversion: m('CONVERSION', 'conversionReadinessScore')?.value ?? null,
        titlePresent: (m('SEO', 'titlePresent')?.value ?? 0) === 1,
        descriptionPresent: (m('SEO', 'descriptionPresent')?.value ?? 0) === 1,
        h1Present: (m('SEO', 'h1Present')?.value ?? 0) > 0,
        canonical: (m('SEO', 'canonical')?.value ?? 0) === 1,
        robots: (m('SEO', 'robots')?.value ?? 0) === 1,
        sitemap: (m('SEO', 'sitemap')?.value ?? 0) === 1,
        structuredData: (m('SEO', 'structuredData')?.value ?? 0) === 1,
        brokenLinks: m('TECHNICAL', 'brokenLinks')?.value ?? null,
        contactForm: (m('CONVERSION', 'contactForm')?.value ?? 0) === 1,
        whatsappCta: (m('CONVERSION', 'whatsappCta')?.value ?? 0) === 1,
        phoneCta: (m('CONVERSION', 'phoneCta')?.value ?? 0) === 1,
        bookingCta: (m('CONVERSION', 'bookingCta')?.value ?? 0) === 1,
        analytics: m('MARKETING', 'analytics')?.valueText ?? 'not detected',
        gtm: m('MARKETING', 'gtm')?.valueText ?? 'not detected',
        metaPixel: m('MARKETING', 'metaPixel')?.valueText ?? 'not detected',
        clarity: m('MARKETING', 'clarity')?.valueText ?? 'not detected',
        cms: technologies.find((t) => t.category === 'cms')?.name,
        framework: technologies.find((t) => t.category === 'framework')?.name,
        libraries: technologies
          .filter((t) => t.category === 'library')
          .map((t) => t.name)
          .join(', '),
        criticalIssues: (audit?.findings as Array<{ severity?: string; message?: string }> | undefined)
          ?.filter((f) => f.severity === 'CRITICAL')
          .map((f) => f.message)
          .join('; '),
        majorIssues: (audit?.findings as Array<{ severity?: string; message?: string }> | undefined)
          ?.filter((f) => f.severity === 'MAJOR')
          .map((f) => f.message)
          .join('; '),
        minorIssues: (audit?.findings as Array<{ severity?: string; message?: string }> | undefined)
          ?.filter((f) => f.severity === 'MINOR')
          .map((f) => f.message)
          .join('; '),
        auditDate: audit?.completedAt,
      });

      for (const c of contacts) {
        contactsOut.push({
          leadId,
          businessName: b.canonicalName ?? b.name,
          contactType: c.type,
          contactValue: c.doNotContact ? '[DO_NOT_CONTACT]' : c.value,
          context: c.context,
          role: c.role,
          source: c.source,
          sourceUrl: c.sourceUrl,
          confidence: c.confidence,
          verificationStatus: c.verificationStatus,
          verifiedAt: c.verifiedAt,
          primaryContact: c.isPrimary,
        });
      }
    }

    const buffer = await buildWorkbook({ leads, contacts: contactsOut, exportedAt: new Date() });
    const dir = resolveExportDir();
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${exportRunId}.xlsx`);
    await writeFile(filePath, Buffer.from(buffer));

    await ExportRunModel.findByIdAndUpdate(exportRunId, {
      status: 'COMPLETED',
      filePath,
      rowCount: leads.length,
      completedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ExportRunModel.findByIdAndUpdate(exportRunId, {
      status: 'FAILED',
      errorMessage: message,
      completedAt: new Date(),
    });
    throw err;
  }
}

export async function finalizeSearchJobFailure(
  searchJobId: string,
  message: string,
): Promise<void> {
  const searchJob = await SearchJobModel.findById(searchJobId).lean();
  if (!searchJob) return;

  const businessCount = (searchJob.businessIds ?? []).length;
  const status = businessCount > 0 ? JobStatus.PARTIALLY_COMPLETED : JobStatus.FAILED;

  await SearchJobModel.findByIdAndUpdate(searchJobId, {
    $set: {
      status,
      errorMessage: message,
      completedAt: new Date(),
      currentStage: status === JobStatus.FAILED ? 'FAILED' : 'PARTIALLY_COMPLETED',
    },
  });

  if (businessCount > 0) {
    await autoExportSearchJobProgress(searchJobId, message);
  }
}

async function autoExportSearchJobProgress(
  searchJobId: string,
  reason: string,
): Promise<string | null> {
  const searchJob = await SearchJobModel.findById(searchJobId).lean();
  if (!searchJob || (searchJob.businessIds ?? []).length === 0) return null;

  const existing = await ExportRunModel.findOne({
    searchJobId,
    'filterSnapshot.autoGeneratedOnFailure': true,
    status: { $in: ['PENDING', 'RUNNING', 'COMPLETED'] },
  }).lean();
  if (existing) return idString(existing._id);

  const run = await ExportRunModel.create({
    searchJobId,
    filterSnapshot: { autoGeneratedOnFailure: true, failureReason: reason },
    status: 'PENDING',
  });
  const exportRunId = idString(run._id);

  try {
    await processExport({ exportRunId });
    logger.info({ searchJobId, exportRunId }, 'auto-export completed after job failure');
    return exportRunId;
  } catch (err) {
    const exportError = err instanceof Error ? err.message : String(err);
    logger.error({ searchJobId, exportRunId, exportError }, 'auto-export failed after job failure');
    return null;
  }
}
