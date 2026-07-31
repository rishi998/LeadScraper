export * from './connection';
export * from './models/business';
export * from './models/business-alias';
export * from './models/website';
export * from './models/contact';
export * from './models/search-job';
export * from './models/processing-job';
export * from './models/crawl';
export * from './models/audit-run';
export * from './models/evidence';
export * from './models/score';
export * from './models/misc';

export function idString(id: { toString(): string } | string | null | undefined): string {
  if (!id) return '';
  return typeof id === 'string' ? id : id.toString();
}
