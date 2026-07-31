'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AuditIcon,
  BuildingIcon,
  DashboardIcon,
  ExportIcon,
  SearchIcon,
} from './icons';
import { PageLoader } from './PageLoader';

const NAV: Array<{
  href: string;
  label: string;
  icon: typeof DashboardIcon;
  exact?: boolean;
}> = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon, exact: true },
  { href: '/search-jobs', label: 'Search Jobs', icon: SearchIcon },
  { href: '/businesses', label: 'Businesses', icon: BuildingIcon },
  { href: '/audits', label: 'Audits', icon: AuditIcon },
  { href: '/exports', label: 'Exports', icon: ExportIcon },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  const current = NAV.find((item) => isActive(pathname, item.href, item.exact));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">LS</div>
          <div>
            <div className="sidebar__name">LeadScraper</div>
            <div className="sidebar__tagline">Lead pipeline</div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar__link${active ? ' sidebar__link--active' : ''}`}
                onClick={() => {
                  if (!active) setNavigating(true);
                }}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <span className="sidebar__hint">Run jobs → export leads</span>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar__brand">
            <span className="topbar__app">LeadScraper</span>
            {current ? (
              <>
                <span className="topbar__sep">/</span>
                <span className="topbar__page">{current.label}</span>
              </>
            ) : null}
          </div>
        </header>

        <main className="main-content">
          {navigating ? <PageLoader label="Loading page…" /> : null}
          <div className={`page-body${navigating ? ' page-body--hidden' : ''}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}
