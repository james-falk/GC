import Link from 'next/link';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { MOCK_ALERTS } from './drift/_data/mock-alerts';

// App shell — top bar + left sidebar nav. See gc-wireframes-brief.md § Screen 1.
// Most nav items are placeholders until their feature lands.

const driftHighCount = MOCK_ALERTS.filter((a) => a.severity === 'high').length;

const NAV: Array<{
  label: string;
  href: string;
  enabled: boolean;
  badge?: number;
}> = [
  { label: 'Dashboard', href: '/dashboard', enabled: false },
  { label: 'Projects', href: '/projects', enabled: true },
  { label: 'Organizations', href: '/organizations', enabled: true },
  { label: 'Subcontractors', href: '/subcontractors', enabled: true },
  { label: 'Pay Apps', href: '/pay-apps', enabled: false },
  { label: 'Change Orders', href: '/change-orders', enabled: false },
  { label: 'Documents', href: '/documents', enabled: false },
  {
    label: 'Drift Alerts',
    href: '/drift',
    enabled: true,
    badge: driftHighCount,
  },
  { label: 'Settings', href: '/settings', enabled: false },
];

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm font-semibold tracking-tight">
            constructor
          </Link>
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/projects"
            afterSelectOrganizationUrl="/projects"
          />
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>
      <div className="flex flex-1">
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) =>
              item.enabled ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ) : (
                <span
                  key={item.href}
                  className="cursor-not-allowed rounded px-3 py-2 text-sm text-slate-400"
                  title="Not yet implemented"
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
