import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'LeadIntel',
  description: 'Business lead intelligence platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="nav">
            <div className="brand">LeadIntel</div>
            <Link href="/">Dashboard</Link>
            <Link href="/search-jobs">Search Jobs</Link>
            <Link href="/businesses">Businesses</Link>
            <Link href="/audits">Audits</Link>
            <Link href="/exports">Exports</Link>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
