import { describe, expect, it, vi } from 'vitest';
import { GooglePlacesProvider, mapGooglePlaceToCandidate } from './google-places.js';

describe('mapGooglePlaceToCandidate', () => {
  it('maps a Google Place to BusinessCandidate', () => {
    const input = {
      city: 'Faridabad',
      state: 'Haryana',
      country: 'India',
      locality: 'Sector 15',
      category: 'dentist',
      queryText: 'dentist Sector 15 Faridabad India',
    };

    const candidate = mapGooglePlaceToCandidate(
      {
        id: 'ChIJabc123',
        displayName: { text: 'Smile Dental Clinic' },
        formattedAddress: 'Sector 15, Faridabad, Haryana',
        location: { latitude: 28.4, longitude: 77.3 },
        nationalPhoneNumber: '+91 98765 43210',
        websiteUri: 'https://smiledental.example/',
        businessStatus: 'OPERATIONAL',
        types: ['dentist', 'health'],
      },
      input,
    );

    expect(candidate).toEqual({
      externalId: 'google-places:ChIJabc123',
      name: 'Smile Dental Clinic',
      category: 'dentist',
      subcategory: 'dentist',
      phone: '+91 98765 43210',
      website: 'https://smiledental.example/',
      address: {
        line1: 'Sector 15, Faridabad, Haryana',
        locality: 'Sector 15',
        city: 'Faridabad',
        state: 'Haryana',
        country: 'India',
        latitude: 28.4,
        longitude: 77.3,
      },
      operationalStatus: 'OPEN',
      queryText: input.queryText,
    });
  });
});

describe('GooglePlacesProvider', () => {
  it('calls Places Text Search and returns mapped candidates', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: 'ChIJxyz',
            displayName: { text: 'City Gym' },
            formattedAddress: 'Main Road, Faridabad',
            businessStatus: 'OPERATIONAL',
          },
        ],
      }),
    });

    const provider = new GooglePlacesProvider('test-key', fetchFn as typeof fetch);
    const input = {
      city: 'Faridabad',
      country: 'India',
      category: 'gym',
      queryText: 'gym Faridabad India',
    };

    const results = await provider.search(input);

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0]?.externalId).toBe('google-places:ChIJxyz');
    expect(results[0]?.name).toBe('City Gym');
  });

  it('throws when API key is missing', async () => {
    const provider = new GooglePlacesProvider('');
    await expect(
      provider.search({
        city: 'Faridabad',
        country: 'India',
        category: 'gym',
        queryText: 'gym Faridabad India',
      }),
    ).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
  });
});
