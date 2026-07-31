import { describe, expect, it } from 'vitest';
import { MockBusinessDiscoveryProvider } from '../src/index.js';

describe('MockBusinessDiscoveryProvider', () => {
  it('returns deterministic candidates with provenance', async () => {
    const provider = new MockBusinessDiscoveryProvider();
    const input = {
      city: 'Faridabad',
      state: 'Haryana',
      country: 'India',
      category: 'dentist',
      queryText: 'dentist Faridabad India',
    };
    const a = await provider.search(input);
    const b = await provider.search(input);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((x) => x.externalId)).toEqual(b.map((x) => x.externalId));
    expect(a[0]?.queryText).toBe(input.queryText);
    expect(provider.storagePolicy.providerId).toBe('mock');
  });
});
