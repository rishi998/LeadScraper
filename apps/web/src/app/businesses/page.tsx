'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PriorityBadge } from '@/components/StatusBadge';
import { apiGet } from '@/lib/api';

type Business = {
  id: string;
  canonicalName: string;
  category?: string | null;
  priority?: string | null;
  websiteHealth?: number | null;
  salesOpportunity?: number | null;
  contactConfidence?: number | null;
  dataQualityGrade?: string | null;
  addresses?: Array<{ city?: string | null; locality?: string | null }>;
};

type ListResponse = {
  items: Business[];
  total: number;
  page: number;
  pageCount: number;
};

export default function BusinessesPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (q) params.set('q', q);
      if (priority) params.set('priority', priority);
      setData(await apiGet<ListResponse>(`/businesses?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        title="Businesses"
        description="Browse discovered leads, filter by priority, and open profiles for full audit data."
      />

      {error ? <p className="error">{error}</p> : null}

      <div className="panel">
        <div className="toolbar">
          <input
            placeholder="Search name or category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="HOT">HOT</option>
            <option value="WARM">WARM</option>
            <option value="REVIEW">REVIEW</option>
            <option value="LOW">LOW</option>
          </select>
          <button className="btn" type="button" onClick={() => void load()}>
            Apply filters
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>City</th>
                <th>Priority</th>
                <th>Health</th>
                <th>Opportunity</th>
                <th>Contact</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty-state">Loading businesses…</td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/businesses/${b.id}`} className="link-btn">
                        {b.canonicalName}
                      </Link>
                    </td>
                    <td>{b.category ?? '—'}</td>
                    <td>{b.addresses?.[0]?.city ?? '—'}</td>
                    <td>{b.priority ? <PriorityBadge priority={b.priority} /> : '—'}</td>
                    <td>{b.websiteHealth?.toFixed?.(1) ?? '—'}</td>
                    <td>{b.salesOpportunity?.toFixed?.(1) ?? '—'}</td>
                    <td>{b.contactConfidence?.toFixed?.(1) ?? '—'}</td>
                    <td>{b.dataQualityGrade ?? '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No businesses yet. Start a <Link href="/search-jobs">search job</Link> first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: '1rem' }}>
          {data ? `${data.total} businesses total` : ''}
        </p>
      </div>
    </div>
  );
}
