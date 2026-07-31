import { PageHeader } from '@/components/PageHeader';
import { apiGet } from '@/lib/api';

type Stats = {
  businessesDiscovered: number;
  verifiedWebsites: number;
  verifiedContacts: number;
  hotLeads: number;
  warmLeads: number;
  averageWebsiteHealth: number | null;
  averageOpportunityScore: number | null;
};

export default async function DashboardPage() {
  let stats: Stats | null = null;
  let error: string | null = null;
  try {
    stats = await apiGet<Stats>('/dashboard/stats');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load stats';
  }

  const cards = [
    { label: 'Businesses Discovered', value: stats?.businessesDiscovered, accent: true },
    { label: 'Verified Websites', value: stats?.verifiedWebsites },
    { label: 'Verified Contacts', value: stats?.verifiedContacts },
    { label: 'HOT Leads', value: stats?.hotLeads, hot: true },
    { label: 'WARM Leads', value: stats?.warmLeads, warm: true },
    {
      label: 'Avg Website Health',
      value: stats?.averageWebsiteHealth != null ? stats.averageWebsiteHealth.toFixed(1) : '—',
    },
    {
      label: 'Avg Opportunity Score',
      value: stats?.averageOpportunityScore != null ? stats.averageOpportunityScore.toFixed(1) : '—',
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Dashboard"
        description="Overview of discovered leads, verification rates, and pipeline health."
      />

      {error ? (
        <p className="error">{error}. Is the API running on port 3001?</p>
      ) : null}

      <div className="grid">
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="label">{c.label}</div>
            <div
              className="value"
              style={
                c.hot
                  ? { color: 'var(--hot)' }
                  : c.warm
                    ? { color: 'var(--warm)' }
                    : c.accent
                      ? { color: 'var(--accent)' }
                      : undefined
              }
            >
              {c.value ?? '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Quick start</h2>
            <p className="panel__subtitle">Three steps to scrape and export leads</p>
          </div>
        </div>
        <div className="quick-links">
          <a className="quick-link" href="/search-jobs">1. Create search job</a>
          <a className="quick-link" href="/businesses">2. Review businesses</a>
          <a className="quick-link" href="/exports">3. Download Excel</a>
        </div>
      </div>
    </div>
  );
}
