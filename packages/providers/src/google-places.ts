import type { BusinessCandidate, BusinessSearchInput, ProviderStoragePolicy } from '@leadintel/shared';
import type { BusinessDiscoveryProvider } from './index.js';

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'places.types',
].join(',');

export const GOOGLE_PLACES_STORAGE_POLICY: ProviderStoragePolicy = {
  providerId: 'google-places',
  allowPersistRawPayload: false,
  allowPersistFields: ['externalId', 'name', 'category', 'phone', 'website', 'address'],
  allowExportFields: ['externalId', 'name', 'website', 'phone'],
  retentionDays: 30,
  notes: 'Google Places terms restrict long-term caching of raw payloads.',
};

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  types?: string[];
}

interface GooglePlacesSearchResponse {
  places?: GooglePlace[];
}

export function mapGooglePlaceToCandidate(
  place: GooglePlace,
  input: BusinessSearchInput,
): BusinessCandidate | null {
  const placeId = place.id;
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) return null;

  const phone = place.nationalPhoneNumber ?? place.internationalPhoneNumber;

  return {
    externalId: `google-places:${placeId}`,
    name,
    category: input.category,
    subcategory: place.types?.[0],
    phone: phone ?? undefined,
    website: place.websiteUri ?? undefined,
    address: {
      line1: place.formattedAddress,
      locality: input.locality,
      city: input.city,
      state: input.state,
      country: input.country,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
    },
    operationalStatus: mapBusinessStatus(place.businessStatus),
    queryText: input.queryText,
  };
}

function mapBusinessStatus(
  status?: string,
): BusinessCandidate['operationalStatus'] {
  switch (status) {
    case 'CLOSED_PERMANENTLY':
      return 'CLOSED';
    case 'CLOSED_TEMPORARILY':
      return 'TEMPORARILY_CLOSED';
    case 'OPERATIONAL':
      return 'OPEN';
    default:
      return 'UNKNOWN';
  }
}

export class GooglePlacesProvider implements BusinessDiscoveryProvider {
  readonly id = 'google-places';
  readonly storagePolicy = GOOGLE_PLACES_STORAGE_POLICY;

  constructor(
    private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY ?? '',
    private readonly fetchFn: typeof fetch = fetch,
    private readonly maxResultCount = Number(process.env.GOOGLE_PLACES_MAX_RESULTS ?? 20),
  ) {}

  async search(input: BusinessSearchInput): Promise<BusinessCandidate[]> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is required when DISCOVERY_PROVIDER=google-places');
    }

    const res = await this.fetchFn(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: input.queryText,
        maxResultCount: this.maxResultCount,
        languageCode: 'en',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Places Text Search failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as GooglePlacesSearchResponse;
    const candidates: BusinessCandidate[] = [];

    for (const place of data.places ?? []) {
      const mapped = mapGooglePlaceToCandidate(place, input);
      if (mapped) candidates.push(mapped);
    }

    return candidates;
  }
}
