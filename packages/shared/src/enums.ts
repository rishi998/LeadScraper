export enum JobStatus {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ProcessingJobType {
  DISCOVERY = 'DISCOVERY',
  ENTITY_RESOLUTION = 'ENTITY_RESOLUTION',
  WEBSITE_VERIFICATION = 'WEBSITE_VERIFICATION',
  CRAWL = 'CRAWL',
  CONTACT_EXTRACTION = 'CONTACT_EXTRACTION',
  AUDIT = 'AUDIT',
  TECHNOLOGY = 'TECHNOLOGY',
  SCORING = 'SCORING',
  ENRICHMENT = 'ENRICHMENT',
  AI_ANALYSIS = 'AI_ANALYSIS',
  EXPORT = 'EXPORT',
}

export enum ProcessingJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum OperationalStatus {
  UNKNOWN = 'UNKNOWN',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
}

export enum WebsiteVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  LIKELY = 'LIKELY',
  UNCERTAIN = 'UNCERTAIN',
  INVALID = 'INVALID',
}

export enum ContactType {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  CONTACT_FORM = 'CONTACT_FORM',
}

export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  CONFIRMED = 'CONFIRMED',
  LIKELY = 'LIKELY',
  REJECTED = 'REJECTED',
}

export enum SourceType {
  BUSINESS_WEBSITE = 'BUSINESS_WEBSITE',
  DISCOVERY_PROVIDER = 'DISCOVERY_PROVIDER',
  STRUCTURED_DATA = 'STRUCTURED_DATA',
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM',
}

export enum SocialPlatform {
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  LINKEDIN = 'LINKEDIN',
  YOUTUBE = 'YOUTUBE',
  X = 'X',
  OTHER = 'OTHER',
}

export enum DataQualityGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum LeadPriority {
  HOT = 'HOT',
  WARM = 'WARM',
  REVIEW = 'REVIEW',
  LOW = 'LOW',
}

export enum FindingSeverity {
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  INFO = 'INFO',
}

export enum MetricDataSource {
  LAB = 'LAB',
  FIELD = 'FIELD',
  STATIC = 'STATIC',
  HEURISTIC = 'HEURISTIC',
}

export enum FetchMethod {
  HTTP = 'HTTP',
  PLAYWRIGHT = 'PLAYWRIGHT',
}

export enum StageStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum ScoreModifier {
  NO_WEBSITE = 'NO_WEBSITE',
  BROKEN_WEBSITE = 'BROKEN_WEBSITE',
  HIGH_BUSINESS_VITALITY = 'HIGH_BUSINESS_VITALITY',
  NO_RELIABLE_CONTACT = 'NO_RELIABLE_CONTACT',
  LOW_AUDIT_CONFIDENCE = 'LOW_AUDIT_CONFIDENCE',
  CLOSED_BUSINESS = 'CLOSED_BUSINESS',
}

export enum RecommendationService {
  WEBSITE_DEVELOPMENT = 'Website Development',
  WEBSITE_REDESIGN = 'Website Redesign',
  PERFORMANCE_OPTIMIZATION = 'Performance Optimization',
  SEO = 'SEO',
  LOCAL_SEO = 'Local SEO',
  CONVERSION_OPTIMIZATION = 'Conversion Optimization',
  WEBSITE_MAINTENANCE = 'Website Maintenance',
  ANALYTICS_SETUP = 'Analytics Setup',
  MARKETING_TRACKING_SETUP = 'Marketing Tracking Setup',
  ADS_READINESS = 'Ads Readiness',
  ECOMMERCE_DEVELOPMENT = 'Ecommerce Development',
  BOOKING_SYSTEM_INTEGRATION = 'Booking System Integration',
}
