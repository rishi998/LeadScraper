import type { BusinessCandidate, BusinessSearchInput, ProviderStoragePolicy } from '@leadintel/shared';
import { GooglePlacesProvider } from './google-places.js';
import { PlaywrightMapsDiscoveryProvider } from './playwright-maps.js';

export { GooglePlacesProvider, mapGooglePlaceToCandidate } from './google-places.js';
export {
  PlaywrightMapsDiscoveryProvider,
  openMapsLoginBrowser,
  extractPlaceIdFromMapsUrl,
  parseMapsAriaLabel,
  mapMapsListingToCandidate,
  listChromeProfiles,
  resolveMapsBrowserProfile,
  launchMapsBrowserContext,
  syncChromeProfileMirror,
  closeAllChromeProcesses,
  openNativeChrome,
  resolveChromeExecutablePath,
} from './playwright-maps.js';

export interface BusinessDiscoveryProvider {
  readonly id: string;
  readonly storagePolicy: ProviderStoragePolicy;
  search(input: BusinessSearchInput): Promise<BusinessCandidate[]>;
}

export const MOCK_STORAGE_POLICY: ProviderStoragePolicy = {
  providerId: 'mock',
  allowPersistRawPayload: true,
  allowPersistFields: ['*'],
  allowExportFields: ['*'],
  retentionDays: null,
  notes: 'Synthetic data for development; all fields permitted.',
};

/** Deterministic mock businesses keyed by city+category. */
export class MockBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly id = 'mock';
  readonly storagePolicy = MOCK_STORAGE_POLICY;

  async search(input: BusinessSearchInput): Promise<BusinessCandidate[]> {
    const seed = `${input.city}|${input.locality ?? ''}|${input.category}|${input.categoryAlias ?? ''}`;
    const base = hashString(seed);
    const count = 3 + (base % 3);
    const locality = input.locality ?? 'Central';
    const results: BusinessCandidate[] = [];

    for (let i = 0; i < count; i++) {
      const n = (base + i * 17) % 10000;
      const slug = `${slugify(input.category)}-${slugify(input.city)}-${n}`;
      const hasWebsite = n % 7 !== 0;
      const name = `${titleCase(input.category)} ${titleCase(locality)} ${n}`;

      results.push({
        externalId: `mock:${slug}`,
        name,
        category: input.category,
        phone: `9${String(800000000 + n).slice(0, 9)}`,
        website: hasWebsite ? `https://www.${slug}.example.com` : undefined,
        address: {
          line1: `${100 + (n % 50)} Main Road`,
          locality,
          city: input.city,
          state: input.state,
          postalCode: String(110000 + (n % 900)).padStart(6, '0'),
          country: input.country,
          latitude: 28.4 + (n % 100) / 1000,
          longitude: 77.3 + (n % 100) / 1000,
        },
        operationalStatus: n % 23 === 0 ? 'CLOSED' : 'OPEN',
        queryText: input.queryText,
        raw: { seed, index: i, provider: 'mock' },
      });
    }

    // Intentional near-duplicate for entity-resolution testing
    if (results[0]) {
      results.push({
        ...results[0],
        externalId: `${results[0].externalId}:dup`,
        name: `${results[0].name} Clinic`,
      });
    }

    return results;
  }
}

export class LicensedDirectoryProvider implements BusinessDiscoveryProvider {
  readonly id = 'licensed-directory';
  readonly storagePolicy: ProviderStoragePolicy = {
    providerId: 'licensed-directory',
    allowPersistRawPayload: true,
    allowPersistFields: ['*'],
    allowExportFields: ['*'],
    retentionDays: null,
    notes: 'Placeholder for licensed directory APIs.',
  };

  async search(_input: BusinessSearchInput): Promise<BusinessCandidate[]> {
    throw new Error('LicensedDirectoryProvider is not configured.');
  }
}

export class SearchDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly id = 'search-discovery';
  readonly storagePolicy: ProviderStoragePolicy = {
    providerId: 'search-discovery',
    allowPersistRawPayload: false,
    allowPersistFields: ['name', 'website', 'externalId'],
    allowExportFields: ['name', 'website'],
    retentionDays: 14,
    notes: 'Search API results often have strict reuse terms.',
  };

  async search(_input: BusinessSearchInput): Promise<BusinessCandidate[]> {
    throw new Error('SearchDiscoveryProvider is not configured.');
  }
}

export class CSVImportProvider implements BusinessDiscoveryProvider {
  readonly id = 'csv-import';
  readonly storagePolicy = MOCK_STORAGE_POLICY;

  constructor(private readonly rows: BusinessCandidate[] = []) {}

  async search(input: BusinessSearchInput): Promise<BusinessCandidate[]> {
    return this.rows.filter(
      (r) =>
        r.queryText.includes(input.category) ||
        r.category === input.category,
    );
  }
}

export function createDiscoveryProvider(id = process.env.DISCOVERY_PROVIDER ?? 'mock'): BusinessDiscoveryProvider {
  switch (id) {
    case 'mock':
      return new MockBusinessDiscoveryProvider();
    case 'google-places':
      return new GooglePlacesProvider();
    case 'playwright-maps':
      return new PlaywrightMapsDiscoveryProvider();
    case 'licensed-directory':
      return new LicensedDirectoryProvider();
    case 'search-discovery':
      return new SearchDiscoveryProvider();
    case 'csv-import':
      return new CSVImportProvider();
    default:
      throw new Error(`Unknown discovery provider: ${id}`);
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
