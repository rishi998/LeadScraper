import type { ProviderStoragePolicy } from '@leadintel/shared';

export interface ContactCompliance {
  doNotContact: boolean;
  optOutDate?: Date | null;
  contactSource?: string | null;
  sourceUrl?: string | null;
  jurisdiction?: string | null;
  consentBasis?: string | null;
}

/** This application never initiates outreach. */
export const OUTREACH_AUTOMATION_ENABLED = false;

export function assertNoOutreachAutomation(): void {
  if (OUTREACH_AUTOMATION_ENABLED) {
    throw new Error('Outreach automation must not be enabled in this application');
  }
}

export function filterExportableFields<T extends Record<string, unknown>>(
  record: T,
  policy: ProviderStoragePolicy,
): Partial<T> {
  if (policy.allowExportFields.includes('*')) return { ...record };
  const out: Partial<T> = {};
  for (const key of Object.keys(record) as (keyof T)[]) {
    if (policy.allowExportFields.includes(String(key))) {
      out[key] = record[key];
    }
  }
  return out;
}

export function shouldPersistField(policy: ProviderStoragePolicy, field: string): boolean {
  return policy.allowPersistFields.includes('*') || policy.allowPersistFields.includes(field);
}

export function redactDoNotContactValue(value: string, compliance: ContactCompliance): string {
  if (compliance.doNotContact) return '[DO_NOT_CONTACT]';
  return value;
}
