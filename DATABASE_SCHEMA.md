# Database Schema (MongoDB)

Database name: `lead_intelligence` (via Atlas URI or `MONGODB_DB_NAME`).

Strict Mongoose schemas — not schema-less.

## Collections & indexes

### businesses
Core current-state firmographics + `currentScores` + `primaryWebsiteId` / `primaryContactIds`.

**Indexes:** `normalizedName`, `city`, `category`, `dataQualityGrade`, `currentScores.salesOpportunity`, `currentScores.websiteHealth`, `currentScores.contactConfidence`, `{city, category}`, `location` (2dsphere, sparse), `searchJobIds`, `primaryWebsiteId`

### business_aliases
`businessId`, `alias`, `normalizedAlias` — indexes on `businessId`, `normalizedAlias`

### websites
`businessId`, `url`, `normalizedUrl`, `domain`, verification fields  
**Indexes:** `domain`, `businessId`, `{businessId, domain}`

### contacts
`businessId`, `type` (PHONE|EMAIL|WHATSAPP|CONTACT_FORM), `value`, `normalizedValue`, confidence…  
**Indexes:** `businessId`, `normalizedValue`, `type`, `confidence`, unique `{businessId, type, normalizedValue}`

### search_jobs
Geography config + progress counters + embedded `discoveryQueries[]` + `businessIds[]`  
**Indexes:** `status`, `city`, `createdAt`

### processing_jobs
MongoDB job queue.  
**Indexes:** `{status, availableAt, priority, createdAt}`, `{status, lockedAt}`, `searchJobId`, `businessId`, `type`

### crawl_runs / crawl_pages
Historical crawls; pages reference `crawlRunId`.  
**Indexes:** `businessId`, `websiteId`, `crawlRunId`

### audit_runs
Append-only history with nested `scores`, `metrics`, `metricList`, `findings`.  
**Indexes:** `{businessId, createdAt}`

### evidence
Independent factual provenance (never AI).  
**Indexes:** `businessId`, `field`, `{businessId, observedAt}`, `auditRunId`

### scores / recommendations
Historical scores; recommendations link `evidenceIds[]`.  
**Indexes:** `{businessId, scoredAt}`, `businessId`

### outreach
1:1 CRM stub by `businessId` (unique)

### export_runs
Export job metadata + `filePath`  
**Indexes:** `status`, `searchJobId`

### sources / technologies
Provider provenance and tech fingerprints (supporting collections).

## References vs embed

| Embed | Reference |
|-------|-----------|
| Business.currentScores | AuditRun, Evidence, Score history |
| AuditRun.metrics/findings | Website, CrawlRun |
| SearchJob.discoveryQueries | Business, ProcessingJob |

## Lead ID

Excel Lead ID = MongoDB ObjectId string (`idString(_id)`).
