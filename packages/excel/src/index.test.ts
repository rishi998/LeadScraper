import { describe, expect, it } from 'vitest';
import { buildWorkbook, sanitizeExcelCell } from '../src/index.js';

describe('excel sanitization', () => {
  it('neutralizes formula injection', () => {
    expect(sanitizeExcelCell('=1+1')).toBe("'=1+1");
  });
});

describe('buildWorkbook', () => {
  it('creates a multi-sheet workbook', async () => {
    const buffer = await buildWorkbook({
      leads: [
        {
          leadId: '00000000-0000-0000-0000-000000000001',
          businessName: 'Test Dental',
          priority: 'HOT',
          city: 'Faridabad',
          websiteHealth: 42,
          salesOpportunity: 81,
          website: 'https://test.example.com',
        },
      ],
      contacts: [
        {
          leadId: '00000000-0000-0000-0000-000000000001',
          businessName: 'Test Dental',
          contactType: 'EMAIL',
          contactValue: 'info@test.example.com',
          primaryContact: true,
        },
      ],
    });
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
