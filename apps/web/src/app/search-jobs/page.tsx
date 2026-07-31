'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiDelete, apiGet, apiPost } from '@/lib/api';

const DELETABLE_JOB_STATUSES = new Set([
  'RUNNING',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'FAILED',
  'CANCELLED',
  'CREATED',
]);

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

type SearchJob = {
  id: string;
  city: string;
  state?: string | null;
  country: string;
  categories: string[];
  localities: string[];
  status: string;
  targetLeadCount: number;
  minimumOpportunityScore: number;
  currentStage?: string | null;
  progressPercent?: number | null;
  totalCandidates?: number;
  totalBusinesses?: number;
  processedBusinesses?: number;
  successfulBusinesses?: number;
  failedBusinesses?: number;
  progress?: Record<string, unknown>;
  createdAt: string;
};

export default function SearchJobsPage() {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    city: 'Faridabad',
    state: 'Haryana',
    country: 'India',
    categories: 'dentist,gym,restaurant',
    localities: '',
    targetLeadCount: 50,
    minimumOpportunityScore: 60,
  });

  async function load() {
    try {
      setJobs(await apiGet<SearchJob[]>('/search-jobs'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function deleteJob(job: SearchJob) {
    if (!DELETABLE_JOB_STATUSES.has(job.status)) return;
    const label = `${job.city}${job.state ? `, ${job.state}` : ''} (${job.categories.join(', ')})`;
    const runningNote = job.status === 'RUNNING' ? ' The running pipeline will be stopped.' : '';
    if (!window.confirm(`Delete search job "${label}"?${runningNote} This cannot be undone.`)) return;

    setDeletingId(job.id);
    try {
      await apiDelete(`/search-jobs/${job.id}`);
      setJobs((current) => current.filter((j) => j.id !== job.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function createJob() {
    setBusy(true);
    try {
      const created = await apiPost<SearchJob>('/search-jobs', {
        city: form.city,
        state: form.state || undefined,
        country: form.country,
        categories: form.categories.split(',').map((s) => s.trim()).filter(Boolean),
        localities: form.localities.split(',').map((s) => s.trim()).filter(Boolean),
        targetLeadCount: Number(form.targetLeadCount),
        minimumOpportunityScore: Number(form.minimumOpportunityScore),
      });
      await apiPost(`/search-jobs/${created.id}/start`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Search Jobs</h1>
      {error && <p className="error">{error}</p>}
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <h2>Create & start job</h2>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void createJob();
          }}
        >
          <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label>State<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
          <label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
          <label>Categories (comma-separated)<input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} /></label>
          <label>Localities (optional)<input value={form.localities} onChange={(e) => setForm({ ...form, localities: e.target.value })} /></label>
          <label>Target lead count<input type="number" value={form.targetLeadCount} onChange={(e) => setForm({ ...form, targetLeadCount: Number(e.target.value) })} /></label>
          <label>Min opportunity score<input type="number" value={form.minimumOpportunityScore} onChange={(e) => setForm({ ...form, minimumOpportunityScore: Number(e.target.value) })} /></label>
          <button className="btn" disabled={busy} type="submit">{busy ? 'Starting…' : 'Create & Start'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="row">
          <h2 style={{ margin: 0 }}>Jobs</h2>
          <button className="btn secondary" type="button" onClick={() => void load()}>Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Categories</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Progress</th>
              <th>Businesses</th>
              <th>Created</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.city}{j.state ? `, ${j.state}` : ''}</td>
                <td>{j.categories.join(', ')}</td>
                <td>{j.status}</td>
                <td>{j.currentStage ?? '—'}</td>
                <td>{j.progressPercent != null ? `${Number(j.progressPercent).toFixed(0)}%` : '—'}</td>
                <td className="muted">
                  {j.processedBusinesses ?? 0}/{j.totalBusinesses ?? 0}
                  {j.failedBusinesses ? ` (${j.failedBusinesses} failed)` : ''}
                </td>
                <td>{new Date(j.createdAt).toLocaleString()}</td>
                <td>
                  {DELETABLE_JOB_STATUSES.has(j.status) ? (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Delete job"
                      aria-label={`Delete job for ${j.city}`}
                      disabled={deletingId === j.id}
                      onClick={() => void deleteJob(j)}
                    >
                      <TrashIcon />
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: '1rem' }}>
          After completion, review <Link href="/businesses">Businesses</Link> and create an <Link href="/exports">Export</Link>.
        </p>
      </div>
    </div>
  );
}
