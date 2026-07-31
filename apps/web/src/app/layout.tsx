import './globals.css';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

export const metadata = {
  title: 'LeadScraper',
  description: 'Business lead scraping and export platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
