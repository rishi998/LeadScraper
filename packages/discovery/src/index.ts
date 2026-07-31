import type { BusinessDiscoveryProvider } from '@leadintel/providers';
import type { BusinessCandidate, SearchJobCreateInput } from '@leadintel/shared';

export interface ExpandedQuery {
  city: string;
  locality?: string;
  category: string;
  categoryAlias?: string;
  queryText: string;
}

export function expandDiscoveryQueries(job: SearchJobCreateInput): ExpandedQuery[] {
  const localities = job.localities.length > 0 ? job.localities : [undefined];
  const queries: ExpandedQuery[] = [];

  for (const locality of localities) {
    for (const category of job.categories) {
      const aliases = job.categoryAliases[category] ?? [];
      const terms = [category, ...aliases];
      for (const term of terms) {
        const isAlias = term !== category;
        const parts = [term, locality, job.city, job.state, job.country].filter(Boolean);
        queries.push({
          city: job.city,
          locality,
          category,
          categoryAlias: isAlias ? term : undefined,
          queryText: parts.join(' '),
        });
      }
    }
  }

  return queries;
}

export interface DiscoveryResult {
  query: ExpandedQuery;
  candidates: BusinessCandidate[];
}

export async function runDiscoveryForQueries(
  provider: BusinessDiscoveryProvider,
  job: SearchJobCreateInput,
): Promise<DiscoveryResult[]> {
  const queries = expandDiscoveryQueries(job);
  const results: DiscoveryResult[] = [];

  for (const query of queries) {
    const candidates = await provider.search({
      city: query.city,
      state: job.state,
      country: job.country,
      locality: query.locality,
      category: query.category,
      categoryAlias: query.categoryAlias,
      queryText: query.queryText,
    });
    results.push({ query, candidates });
  }

  return results;
}

export function canPersistField(policy: { allowPersistFields: string[] }, field: string): boolean {
  return policy.allowPersistFields.includes('*') || policy.allowPersistFields.includes(field);
}

export function canExportField(policy: { allowExportFields: string[] }, field: string): boolean {
  return policy.allowExportFields.includes('*') || policy.allowExportFields.includes(field);
}
