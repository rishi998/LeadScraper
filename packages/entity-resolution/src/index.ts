import {
  extractDomain,
  normalizeAddressKey,
  normalizeBusinessName,
  normalizePhone,
  similarityRatio,
} from '@leadintel/shared';

export interface EntityRecord {
  id: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  address?: {
    line1?: string | null;
    locality?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
}

export interface MatchResult {
  leftId: string;
  rightId: string;
  entityMatchScore: number;
  reasons: string[];
}

const MATCH_THRESHOLD = 0.82;

export function scoreEntityPair(a: EntityRecord, b: EntityRecord): MatchResult {
  let score = 0;
  let weight = 0;
  const reasons: string[] = [];

  const domainA = a.website ? extractDomain(a.website) : null;
  const domainB = b.website ? extractDomain(b.website) : null;
  if (domainA && domainB) {
    weight += 0.35;
    if (domainA === domainB) {
      score += 0.35;
      reasons.push('exact_domain');
    }
  }

  const phoneA = a.phone ? normalizePhone(a.phone) : null;
  const phoneB = b.phone ? normalizePhone(b.phone) : null;
  if (phoneA && phoneB) {
    weight += 0.3;
    if (phoneA === phoneB) {
      score += 0.3;
      reasons.push('exact_phone');
    }
  }

  const nameA = normalizeBusinessName(a.name);
  const nameB = normalizeBusinessName(b.name);
  const nameSim = similarityRatio(nameA, nameB);
  weight += 0.25;
  score += 0.25 * nameSim;
  if (nameSim >= 0.9) reasons.push('strong_name');
  else if (nameSim >= 0.75) reasons.push('fuzzy_name');

  if (a.address && b.address) {
    const keyA = normalizeAddressKey(a.address);
    const keyB = normalizeAddressKey(b.address);
    const addrSim = similarityRatio(keyA, keyB);
    weight += 0.1;
    score += 0.1 * addrSim;
    if (addrSim >= 0.9) reasons.push('address');
  }

  const entityMatchScore = weight > 0 ? score / weight : 0;
  return {
    leftId: a.id,
    rightId: b.id,
    entityMatchScore,
    reasons,
  };
}

export function findDuplicatePairs(records: EntityRecord[]): MatchResult[] {
  const matches: MatchResult[] = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const result = scoreEntityPair(records[i]!, records[j]!);
      if (
        result.entityMatchScore >= MATCH_THRESHOLD ||
        result.reasons.includes('exact_domain') ||
        result.reasons.includes('exact_phone')
      ) {
        matches.push(result);
      }
    }
  }
  return matches.sort((a, b) => b.entityMatchScore - a.entityMatchScore);
}

/** Union-find style clustering for merge groups. */
export function clusterDuplicates(records: EntityRecord[]): string[][] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p !== id) {
      const root = find(p);
      parent.set(id, root);
      return root;
    }
    return id;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const r of records) parent.set(r.id, r.id);
  for (const match of findDuplicatePairs(records)) {
    union(match.leftId, match.rightId);
  }

  const clusters = new Map<string, string[]>();
  for (const r of records) {
    const root = find(r.id);
    const list = clusters.get(root) ?? [];
    list.push(r.id);
    clusters.set(root, list);
  }
  return [...clusters.values()];
}
