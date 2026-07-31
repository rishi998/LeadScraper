import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditRunModel,
  BusinessModel,
  ContactModel,
  CrawlRunModel,
  EvidenceModel,
  RecommendationModel,
  ScoreModel,
  TechnologyModel,
  WebsiteModel,
  idString,
} from '@leadintel/database';
import type { JobQueue } from '@leadintel/job-queue';
import { ProcessingJobType } from '@leadintel/shared';
import { JOB_QUEUE } from './tokens';

@Injectable()
export class BusinessesService {
  constructor(@Inject(JOB_QUEUE) private readonly jobQueue: JobQueue) {}

  async list(params: {
    page: number;
    pageSize: number;
    city?: string;
    category?: string;
    priority?: string;
    dataQualityGrade?: string;
    q?: string;
    minWebsiteHealth?: number;
    minSalesOpportunity?: number;
    minContactConfidence?: number;
    sort?: string;
  }) {
    const filter: Record<string, unknown> = {};
    if (params.category) filter.category = params.category;
    if (params.priority) filter['currentScores.priority'] = params.priority;
    if (params.dataQualityGrade) filter.dataQualityGrade = params.dataQualityGrade;
    if (params.city) filter.city = new RegExp(params.city, 'i');
    if (params.q) {
      filter.$or = [
        { canonicalName: new RegExp(params.q, 'i') },
        { name: new RegExp(params.q, 'i') },
        { category: new RegExp(params.q, 'i') },
      ];
    }
    if (params.minWebsiteHealth != null) {
      filter['currentScores.websiteHealth'] = { $gte: params.minWebsiteHealth };
    }
    if (params.minSalesOpportunity != null) {
      filter['currentScores.salesOpportunity'] = { $gte: params.minSalesOpportunity };
    }
    if (params.minContactConfidence != null) {
      filter['currentScores.contactConfidence'] = { $gte: params.minContactConfidence };
    }

    const sort: Record<string, 1 | -1> =
      params.sort === 'websiteHealth'
        ? { 'currentScores.websiteHealth': -1 }
        : params.sort === 'name'
          ? { canonicalName: 1 }
          : { 'currentScores.salesOpportunity': -1 };

    const [docs, total] = await Promise.all([
      BusinessModel.find(filter)
        .sort(sort)
        .skip((params.page - 1) * params.pageSize)
        .limit(params.pageSize)
        .lean(),
      BusinessModel.countDocuments(filter),
    ]);

    const items = await Promise.all(
      docs.map(async (b) => {
        const contacts = await ContactModel.find({
          businessId: b._id,
          isPrimary: true,
        }).lean();
        return {
          id: idString(b._id),
          canonicalName: b.canonicalName ?? b.name,
          category: b.category,
          priority: b.currentScores?.priority,
          websiteHealth: b.currentScores?.websiteHealth,
          salesOpportunity: b.currentScores?.salesOpportunity,
          contactConfidence: b.currentScores?.contactConfidence,
          dataQualityGrade: b.dataQualityGrade,
          auditConfidence: b.currentScores?.auditConfidence,
          addresses: b.address
            ? [{ city: b.city, locality: b.locality, line1: b.address.line1 }]
            : [],
          websites: [],
          contacts: contacts.map((c) => ({
            id: idString(c._id),
            type: c.type,
            value: c.value,
            confidence: c.confidence,
            isPrimary: c.isPrimary,
          })),
        };
      }),
    );

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.ceil(total / params.pageSize),
    };
  }

  async get(id: string) {
    const b = await BusinessModel.findById(id).lean();
    if (!b) return null;

    const [contacts, websites, evidence, technologies, recommendations, scores, auditRuns, crawlRuns] =
      await Promise.all([
        ContactModel.find({ businessId: id }).lean(),
        WebsiteModel.find({ businessId: id }).lean(),
        EvidenceModel.find({ businessId: id }).sort({ observedAt: -1 }).limit(100).lean(),
        TechnologyModel.find({ businessId: id }).lean(),
        RecommendationModel.find({ businessId: id }).sort({ priority: 1 }).lean(),
        ScoreModel.find({ businessId: id }).sort({ scoredAt: -1 }).limit(5).lean(),
        AuditRunModel.find({ businessId: id }).sort({ createdAt: -1 }).lean(),
        CrawlRunModel.find({ businessId: id }).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

    return {
      id: idString(b._id),
      canonicalName: b.canonicalName ?? b.name,
      category: b.category,
      subcategory: b.subcategory,
      operationalStatus: b.operationalStatus,
      dataQualityGrade: b.dataQualityGrade,
      priority: b.currentScores?.priority,
      websiteHealth: b.currentScores?.websiteHealth,
      marketReadiness: b.currentScores?.marketReadiness,
      conversionReadiness: b.currentScores?.conversionReadiness,
      businessVitality: b.currentScores?.businessVitality,
      contactConfidence: b.currentScores?.contactConfidence,
      salesOpportunity: b.currentScores?.salesOpportunity,
      auditConfidence: b.currentScores?.auditConfidence,
      addresses: b.address
        ? [
            {
              line1: b.address.line1,
              locality: b.locality,
              city: b.city,
              state: b.state,
              postalCode: b.postalCode,
              country: b.country,
            },
          ]
        : [],
      websites: websites.map((w) => ({
        id: idString(w._id),
        url: w.url,
        domain: w.domain,
        verificationStatus: w.verificationStatus,
        websiteConfidence: w.confidence,
      })),
      contacts: contacts.map((c) => ({
        id: idString(c._id),
        type: c.type,
        value: c.value,
        confidence: c.confidence,
        isPrimary: c.isPrimary,
        verificationStatus: c.verificationStatus,
        context: c.context,
      })),
      evidence: evidence.map((e) => ({
        id: idString(e._id),
        field: e.field,
        value: e.value,
        method: e.method,
        confidence: e.confidence,
      })),
      technologies: technologies.map((t) => ({
        id: idString(t._id),
        name: t.name,
        category: t.category,
      })),
      recommendations: recommendations.map((r) => ({
        id: idString(r._id),
        service: r.service,
        reason: r.reason,
        priority: r.priority,
      })),
      scores: scores.map((s) => ({
        id: idString(s._id),
        components: s.components,
        scoredAt: s.scoredAt,
      })),
      auditRuns: auditRuns.map((a) => ({
        id: idString(a._id),
        status: a.status,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
        metrics: a.metricList,
        findings: a.findings,
      })),
      crawlRuns: crawlRuns.map((c) => ({
        id: idString(c._id),
        status: c.status,
        createdAt: c.createdAt,
      })),
      socialProfiles: [],
      sources: [],
      outreach: null,
    };
  }

  contacts(businessId: string) {
    return ContactModel.find({ businessId }).sort({ confidence: -1 }).lean();
  }

  audits(businessId: string) {
    return AuditRunModel.find({ businessId }).sort({ createdAt: -1 }).lean();
  }

  evidence(businessId: string) {
    return EvidenceModel.find({ businessId }).sort({ observedAt: -1 }).lean();
  }

  async reAudit(businessId: string) {
    const business = await BusinessModel.findById(businessId);
    if (!business) throw new NotFoundException('Business not found');
    const crawl = await CrawlRunModel.findOne({ businessId, status: 'COMPLETED' }).sort({
      completedAt: -1,
    });
    if (!crawl) throw new NotFoundException('No crawl run available for re-audit');

    const searchJobId = business.searchJobIds?.[0]
      ? idString(business.searchJobIds[0])
      : undefined;

    // Always enqueue a new append-only audit run; freshness skips expensive
    // performance/technology stages inside the worker when artifacts are fresh.
    await this.jobQueue.enqueue({
      type: ProcessingJobType.AUDIT,
      searchJobId,
      businessId,
      payload: {
        searchJobId,
        businessId,
        crawlRunId: idString(crawl._id),
      },
      priority: 50,
    });
    return {
      queued: true,
      businessId,
      crawlRunId: idString(crawl._id),
      note: 'Append-only audit; performance/technology reuse freshness windows when applicable',
    };
  }
}
