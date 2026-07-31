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
    { label: 'Businesses Discovered', value: stats?.businessesDiscovered },
    { label: 'Verified Websites', value: stats?.verifiedWebsites },
    { label: 'Verified Contacts', value: stats?.verifiedContacts },
    { label: 'HOT Leads', value: stats?.hotLeads },
    { label: 'WARM Leads', value: stats?.warmLeads },
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
    <div>
      <h1>Dashboard</h1>
      <p className="muted">Lead intelligence overview</p>
      {error && <p className="error">{error}. Is the API running on port 3001?</p>}
      <div className="grid">
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value ?? '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
