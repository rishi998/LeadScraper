import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { PriorityBadge } from '@/components/StatusBadge';
import { apiGet } from '@/lib/api';

export default async function BusinessDetailPage({ params }: { params: { id: string } }) {
  let business: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    business = await apiGet(`/businesses/${params.id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  if (error || !business) {
    return (
      <div className="page-stack">
        <PageHeader title="Business" description="Lead profile" />
        <p className="error">{error ?? 'Not found'}</p>
        <Link className="quick-link" href="/businesses">← Back to businesses</Link>
      </div>
    );
  }

  const addresses = (business.addresses as Array<Record<string, unknown>>) ?? [];
  const contacts = (business.contacts as Array<Record<string, unknown>>) ?? [];
  const scores = (business.scores as Array<Record<string, unknown>>) ?? [];
  const recommendations = (business.recommendations as Array<Record<string, unknown>>) ?? [];
  const evidence = (business.evidence as Array<Record<string, unknown>>) ?? [];
  const technologies = (business.technologies as Array<Record<string, unknown>>) ?? [];
  const websites = (business.websites as Array<Record<string, unknown>>) ?? [];
  const auditRuns = (business.auditRuns as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        title={String(business.canonicalName)}
        description={`${String(business.category ?? 'Business')} · Grade ${String(business.dataQualityGrade ?? '—')}`}
        actions={
          business.priority ? <PriorityBadge priority={String(business.priority)} /> : null
        }
      />

      <div className="grid">
        {[
          ['Website Health', business.websiteHealth],
          ['Opportunity', business.salesOpportunity],
          ['Vitality', business.businessVitality],
          ['Contact Confidence', business.contactConfidence],
          ['Audit Confidence', business.auditConfidence],
        ].map(([label, value]) => (
          <div className="card" key={String(label)}>
            <div className="label">{String(label)}</div>
            <div className="value">{value != null ? Number(value).toFixed(1) : '—'}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2 className="panel__title">Profile</h2>
        <p>Address: {addresses[0] ? [addresses[0].line1, addresses[0].locality, addresses[0].city].filter(Boolean).join(', ') : '—'}</p>
        <p>
          Website:{' '}
          {websites[0] ? (
            <a href={String(websites[0].url)} target="_blank" rel="noreferrer">
              {String(websites[0].url)}
            </a>
          ) : (
            '—'
          )}
        </p>
        <p>Verification: {websites[0] ? String(websites[0].verificationStatus) : '—'}</p>
        <p>Operational: {String(business.operationalStatus)}</p>
      </div>

      <div className="panel">
        <h2 className="panel__title">Contacts</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>Confidence</th>
                <th>Primary</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length ? (
                contacts.map((c) => (
                  <tr key={String(c.id)}>
                    <td>{String(c.type)}</td>
                    <td>{String(c.value)}</td>
                    <td>{Number(c.confidence).toFixed(2)}</td>
                    <td>{c.isPrimary ? 'Yes' : ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-state">No contacts extracted yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Recommendations</h2>
        {recommendations.length ? (
          <ul>
            {recommendations.map((r) => (
              <li key={String(r.id)}>
                <strong>{String(r.service)}</strong> — {String(r.reason)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No recommendations yet</p>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Technologies</h2>
        <p>{technologies.map((t) => String(t.name)).join(', ') || 'None detected'}</p>
      </div>

      <div className="panel">
        <h2 className="panel__title">Latest score components</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
          {JSON.stringify(scores[0]?.components ?? {}, null, 2)}
        </pre>
      </div>

      <div className="panel">
        <h2 className="panel__title">Audit history</h2>
        {auditRuns.length ? (
          <ul>
            {auditRuns.map((a) => (
              <li key={String(a.id)}>
                {String(a.status)} · {String(a.completedAt ?? a.createdAt)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No audits yet</p>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Evidence</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
                <th>Method</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {evidence.slice(0, 30).map((e) => (
                <tr key={String(e.id)}>
                  <td>{String(e.field)}</td>
                  <td>{String(e.value)}</td>
                  <td>{String(e.method)}</td>
                  <td>{Number(e.confidence).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Link className="quick-link" href="/businesses">← Back to businesses</Link>
    </div>
  );
}
