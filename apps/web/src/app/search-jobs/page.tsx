'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { TrashIcon } from '@/components/icons';
import { StatusBadge } from '@/components/StatusBadge';
import { apiDelete, apiGet, apiPost } from '@/lib/api';

const DELETABLE_JOB_STATUSES = new Set([
  'RUNNING',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'FAILED',
  'CANCELLED',
  'CREATED',
]);

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
  createdAt: string;
};

export default function SearchJobsPage() {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      setJobs(await apiGet<SearchJob[]>('/search-jobs'));
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
    <div className="page-stack">
      <PageHeader
        title="Search Jobs"
        description="Configure a city/category search, start the scraper pipeline, and track progress live."
      />

      {error ? <p className="error">{error}</p> : null}

      <div className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Create & start job</h2>
            <p className="panel__subtitle">Jobs run discovery → enrichment → scoring automatically</p>
          </div>
        </div>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void createJob();
          }}
        >
          <div className="form-grid">
            <label>
              City
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <label>
              State
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </label>
            <label>
              Country
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </label>
            <label>
              Target lead count
              <input
                type="number"
                value={form.targetLeadCount}
                onChange={(e) => setForm({ ...form, targetLeadCount: Number(e.target.value) })}
              />
            </label>
            <label>
              Min opportunity score
              <input
                type="number"
                value={form.minimumOpportunityScore}
                onChange={(e) => setForm({ ...form, minimumOpportunityScore: Number(e.target.value) })}
              />
            </label>
          </div>
          <label>
            Categories (comma-separated)
            <input
              value={form.categories}
              onChange={(e) => setForm({ ...form, categories: e.target.value })}
            />
          </label>
          <label>
            Localities (optional, comma-separated)
            <input
              value={form.localities}
              onChange={(e) => setForm({ ...form, localities: e.target.value })}
            />
          </label>
          <div>
            <button className="btn" disabled={busy} type="submit">
              {busy ? 'Starting pipeline…' : 'Create & Start'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Active & past jobs</h2>
            <p className="panel__subtitle">{jobs.length} job{jobs.length === 1 ? '' : 's'} in history</p>
          </div>
          <button className="btn ghost" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty-state">Loading jobs…</td>
                </tr>
              ) : jobs.length ? (
                jobs.map((j) => {
                  const pct = j.progressPercent != null ? Number(j.progressPercent) : null;
                  return (
                    <tr key={j.id}>
                      <td>
                        <strong>{j.city}</strong>
                        {j.state ? `, ${j.state}` : ''}
                      </td>
                      <td>{j.categories.join(', ')}</td>
                      <td><StatusBadge status={j.status} /></td>
                      <td>{j.currentStage ?? '—'}</td>
                      <td>
                        {pct != null ? (
                          <div>
                            <div className="progress-bar">
                              <div className="progress-bar__fill" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <div className="progress-label">{pct.toFixed(0)}%</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="muted">
                        {j.processedBusinesses ?? 0}/{j.totalBusinesses ?? 0}
                        {j.failedBusinesses ? ` · ${j.failedBusinesses} failed` : ''}
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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="empty-state">No jobs yet. Create one above to start scraping.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="quick-links">
          <Link className="quick-link" href="/businesses">View businesses</Link>
          <Link className="quick-link" href="/exports">Export to Excel</Link>
        </div>
      </div>
    </div>
  );
}
