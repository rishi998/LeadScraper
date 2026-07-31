'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  websites?: Array<{ url: string }>;
};

type ListResponse = {
  items: Business[];
  total: number;
  page: number;
  pageCount: number;
};

export default function BusinessesPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(page = 1) {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (q) params.set('q', q);
      if (priority) params.set('priority', priority);
      setData(await apiGet<ListResponse>(`/businesses?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <h1>Businesses</h1>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <input placeholder="Search name/category" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="HOT">HOT</option>
          <option value="WARM">WARM</option>
          <option value="REVIEW">REVIEW</option>
          <option value="LOW">LOW</option>
        </select>
        <button className="btn" type="button" onClick={() => void load()}>Filter</button>
      </div>
      <div className="panel">
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
            {data?.items.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/businesses/${b.id}`}>{b.canonicalName}</Link></td>
                <td>{b.category}</td>
                <td>{b.addresses?.[0]?.city ?? '—'}</td>
                <td>{b.priority ? <span className={`badge ${b.priority}`}>{b.priority}</span> : '—'}</td>
                <td>{b.websiteHealth?.toFixed?.(1) ?? '—'}</td>
                <td>{b.salesOpportunity?.toFixed?.(1) ?? '—'}</td>
                <td>{b.contactConfidence?.toFixed?.(1) ?? '—'}</td>
                <td>{b.dataQualityGrade ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{data ? `${data.total} businesses` : 'Loading…'}</p>
      </div>
    </div>
  );
}
