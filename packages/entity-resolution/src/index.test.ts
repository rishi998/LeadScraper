import { describe, expect, it } from 'vitest';
import { clusterDuplicates, scoreEntityPair } from '../src/index.js';

describe('entity resolution', () => {
  it('strongly matches exact domain and phone', () => {
    const result = scoreEntityPair(
      {
        id: '1',
        name: 'Smile Care Dental',
        phone: '9876543210',
        website: 'https://smilecare.example.com',
      },
      {
        id: '2',
        name: 'Smile Care Dental Clinic',
        phone: '+91 98765 43210',
        website: 'https://www.smilecare.example.com',
      },
    );
    expect(result.entityMatchScore).toBeGreaterThan(0.9);
    expect(result.reasons).toEqual(expect.arrayContaining(['exact_domain', 'exact_phone']));
  });

  it('clusters duplicates without dropping ids', () => {
    const clusters = clusterDuplicates([
      { id: 'a', name: 'Acme Gym', phone: '9999999999', website: 'https://acme.example.com' },
      { id: 'b', name: 'Acme Gym Rohini', phone: '9999999999', website: 'https://acme.example.com' },
      { id: 'c', name: 'Other Place', phone: '8888888888', website: 'https://other.example.com' },
    ]);
    const merged = clusters.find((c) => c.includes('a'));
    expect(merged?.sort()).toEqual(['a', 'b']);
    expect(clusters.flat().sort()).toEqual(['a', 'b', 'c']);
  });
});
