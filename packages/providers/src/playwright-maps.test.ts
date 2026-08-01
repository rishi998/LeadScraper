import { describe, expect, it } from 'vitest';
import {
  extractMapsPlaceDetails,
  extractPlaceIdFromMapsUrl,
  isMapsAggregatorHost,
  mapMapsListingToCandidate,
  parseMapsAriaLabel,
  parsePhoneFromMapsLabel,
  parsePhoneFromTelHref,
  pickMapsWebsiteUrl,
  unwrapGoogleRedirectUrl,
} from './playwright-maps.js';

describe('parseMapsAriaLabel', () => {
  it('parses name, category, and address from aria-label', () => {
    expect(
      parseMapsAriaLabel(
        'Smile Dental Clinic · 4.5 stars · Dentist · Sector 15, Faridabad, Haryana',
      ),
    ).toEqual({
      name: 'Smile Dental Clinic',
      categoryHint: 'Dentist',
      addressHint: 'Sector 15, Faridabad, Haryana',
    });
  });
});

describe('extractPlaceIdFromMapsUrl', () => {
  it('extracts hex place id from maps href', () => {
    const href =
      'https://www.google.com/maps/place/Test/@28.4,77.3,17z/data=!3m1!4b1!4m6!3m5!1s0x390ce5a431738343:0x942b67159a534d2!8m2!3d28.4595!4d77.0266';
    expect(extractPlaceIdFromMapsUrl(href)).toBe('0x390ce5a431738343:0x942b67159a534d2');
  });
});

describe('mapMapsListingToCandidate', () => {
  it('maps scraped listing to BusinessCandidate', () => {
    const candidate = mapMapsListingToCandidate(
      {
        name: 'City Gym',
        href: 'https://www.google.com/maps/place/City+Gym/data=!1s0xabc:0xdef',
        placeId: '0xabc:0xdef',
        addressHint: 'Main Road, Faridabad',
      },
      {
        city: 'Faridabad',
        country: 'India',
        category: 'gym',
        queryText: 'gym Faridabad India',
      },
    );

    expect(candidate.externalId).toBe('google-maps:0xabc:0xdef');
    expect(candidate.name).toBe('City Gym');
    expect(candidate.address?.line1).toBe('Main Road, Faridabad');
  });

  it('includes phone and website when present on listing', () => {
    const candidate = mapMapsListingToCandidate(
      {
        name: 'City Gym',
        href: 'https://www.google.com/maps/place/City+Gym/data=!1s0xabc:0xdef',
        placeId: '0xabc:0xdef',
        phone: '+91 98765 43210',
        website: 'https://citygym.example/',
      },
      {
        city: 'Faridabad',
        country: 'India',
        category: 'gym',
        queryText: 'gym Faridabad India',
      },
    );

    expect(candidate.phone).toBe('+91 98765 43210');
    expect(candidate.website).toBe('https://citygym.example/');
  });
});

describe('extractMapsPlaceDetails', () => {
  it('extracts phone from tel link and website from authority link', () => {
    expect(
      extractMapsPlaceDetails({
        telHrefs: ['tel:+919876543210'],
        linkHrefs: [
          'https://www.google.com/url?q=https%3A%2F%2Fcitygym.in&sa=U',
          'https://www.google.com/maps',
        ],
        buttonLabels: [],
      }),
    ).toEqual({
      phone: '+919876543210',
      website: 'https://citygym.in',
    });
  });

  it('extracts phone from aria label when tel link missing', () => {
    expect(
      extractMapsPlaceDetails({
        telHrefs: [],
        linkHrefs: [],
        buttonLabels: ['Phone: +91 98765 43210'],
      }),
    ).toEqual({
      phone: '+91 98765 43210',
      website: undefined,
    });
  });
});

describe('unwrapGoogleRedirectUrl', () => {
  it('unwraps google redirect links', () => {
    expect(
      unwrapGoogleRedirectUrl(
        'https://www.google.com/url?q=https%3A%2F%2Fexample.com&sa=U&ved=0',
      ),
    ).toBe('https://example.com');
  });
});

describe('parsePhoneFromTelHref', () => {
  it('parses tel href', () => {
    expect(parsePhoneFromTelHref('tel:+91-9876543210')).toBe('+91-9876543210');
  });
});

describe('parsePhoneFromMapsLabel', () => {
  it('parses phone label', () => {
    expect(parsePhoneFromMapsLabel('Phone: +91 98765 43210')).toBe('+91 98765 43210');
  });
});

describe('pickMapsWebsiteUrl', () => {
  it('skips google hosts', () => {
    expect(
      pickMapsWebsiteUrl([
        'https://www.google.com/maps/place/test',
        'https://business.example/contact',
      ]),
    ).toBe('https://business.example/contact');
  });

  it('skips directories, delivery apps, and social profiles', () => {
    expect(
      pickMapsWebsiteUrl([
        'https://www.zomato.com/ncr/indian-punch-restaurant',
        'https://www.tablecheck.com/en/andaz-delhi/reserve',
        'https://www.instagram.com/indianpunch',
        'https://indianpunch.in/',
      ]),
    ).toBe('https://indianpunch.in/');
  });

  it('returns undefined when only aggregator links exist', () => {
    expect(pickMapsWebsiteUrl(['https://www.swiggy.com/restaurants/abc'])).toBeUndefined();
  });
});

describe('isMapsAggregatorHost', () => {
  it('matches bare and subdomain forms', () => {
    expect(isMapsAggregatorHost('zomato.com')).toBe(true);
    expect(isMapsAggregatorHost('www.zomato.com')).toBe(true);
    expect(isMapsAggregatorHost('order.swiggy.com')).toBe(true);
    expect(isMapsAggregatorHost('daryaganj.com')).toBe(false);
  });
});

describe('extractMapsPlaceDetails website preference', () => {
  it('prefers the authority link over other links on the panel', () => {
    expect(
      extractMapsPlaceDetails({
        telHrefs: [],
        authorityHrefs: ['https://daryaganj.com/'],
        linkHrefs: ['https://www.zomato.com/ncr/daryaganj', 'https://daryaganj.com/'],
        buttonLabels: [],
      }).website,
    ).toBe('https://daryaganj.com/');
  });

  it('falls back to a non-aggregator link when the authority row is absent', () => {
    expect(
      extractMapsPlaceDetails({
        telHrefs: [],
        linkHrefs: ['https://www.zomato.com/ncr/daryaganj', 'https://daryaganj.com/'],
        buttonLabels: [],
      }).website,
    ).toBe('https://daryaganj.com/');
  });
});
