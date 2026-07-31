import { describe, expect, it } from 'vitest';
import { expandDiscoveryQueries } from '../src/index.js';

describe('expandDiscoveryQueries', () => {
  it('expands city x locality x category x aliases', () => {
    const queries = expandDiscoveryQueries({
      city: 'Delhi',
      country: 'India',
      localities: ['Rohini', 'Dwarka'],
      categories: ['dentist'],
      categoryAliases: { dentist: ['dental clinic'] },
      targetLeadCount: 10,
      minimumOpportunityScore: 60,
      enablePremiumEnrichment: false,
      enableAIAnalysis: false,
    });
    expect(queries).toHaveLength(4);
    expect(queries.map((q) => q.queryText)).toEqual(
      expect.arrayContaining([
        'dentist Rohini Delhi India',
        'dental clinic Rohini Delhi India',
        'dentist Dwarka Delhi India',
        'dental clinic Dwarka Delhi India',
      ]),
    );
  });
});
