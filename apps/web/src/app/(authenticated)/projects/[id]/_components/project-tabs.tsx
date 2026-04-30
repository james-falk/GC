'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: Array<{ label: string; segment: string }> = [
  { label: 'SoV', segment: '' },
  { label: 'Subs', segment: 'subs' },
  { label: 'Pay Apps', segment: 'pay-apps' },
  { label: 'Change Orders', segment: 'change-orders' },
  { label: 'Documents', segment: 'documents' },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav className="-mb-px flex gap-6">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment ? pathname === href : pathname === base;
        return (
          <Link
            key={tab.segment || 'sov'}
            href={href}
            className={
              active
                ? 'border-b-2 border-blue-700 pb-2 text-sm font-medium text-blue-700'
                : 'border-b-2 border-transparent pb-2 text-sm text-slate-600 transition hover:text-slate-900'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
