import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
    subtitle: 'Coming next: partner ROAS across days.',
  },
  '/app/rules': {
    title: 'CPA Rules',
    subtitle: 'Coming next: create and preview commission rules.',
  },
  '/app/audit': {
    title: 'Order Audit',
    subtitle: 'Coming next: why a rule won on a single order.',
  },
};

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

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
