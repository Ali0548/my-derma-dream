import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchYearPerformance } from '../../api/prefetchPerformance';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const titles: Record<string, { title: string; subtitle: string }> = {
  '/app': {
    title: 'Overview',
    subtitle: 'See which partners make money — and which do not.',
  },
  '/app/users': {
    title: 'Users',
    subtitle: 'People who can manage CPA rules and reporting.',
  },
  '/app/performance': {
    title: 'Performance',
    subtitle: 'Partners across days — revenue, spend, ROAS, sales, and AOV.',
  },
  '/app/rules': {
    title: 'CPA Rules',
    subtitle: 'Create and edit contracts, check overlaps, and preview a sale.',
  },
  '/app/audit': {
    title: 'Order Audit',
    subtitle: 'Open any order to see which rule won and why others were skipped.',
  },
};

/** Warm the Performance route chunk so the tab opens without a download stall. */
const performanceImport = () => import('../../pages/PerformancePage');

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    void performanceImport();
    void prefetchYearPerformance(queryClient).catch(() => {
      /* first paint still works; Performance page will retry */
    });
  }, [queryClient]);

  const meta = useMemo(() => {
    return (
      titles[location.pathname] ?? {
        title: 'Lumora',
        subtitle: 'Affiliate commission platform',
      }
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-col px-4 pb-4 pt-2 sm:px-5 lg:ml-[17.5rem] lg:px-8 lg:pb-6">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
