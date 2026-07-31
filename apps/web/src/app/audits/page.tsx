import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { apiGet } from '@/lib/api';

type ListResponse = {
  items: Array<{
    id: string;
    canonicalName: string;
    auditConfidence?: number | null;
    websiteHealth?: number | null;
  }>;
};

export default async function AuditsPage() {
  let items: ListResponse['items'] = [];
  let error: string | null = null;
  try {
    const data = await apiGet<ListResponse>('/businesses?pageSize=50&sort=websiteHealth');
    items = data.items.filter((b) => b.auditConfidence != null);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Audits"
        description="Businesses with completed website audits and confidence scores."
      />

      {error ? <p className="error">{error}</p> : null}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Website Health</th>
                <th>Audit Confidence</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/businesses/${b.id}`} className="link-btn">
                        {b.canonicalName}
                      </Link>
                    </td>
                    <td>{b.websiteHealth?.toFixed?.(1) ?? '—'}</td>
                    <td>{b.auditConfidence?.toFixed?.(1) ?? '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="empty-state">
                    No audited businesses yet. Run a search job and wait for the pipeline to finish.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
