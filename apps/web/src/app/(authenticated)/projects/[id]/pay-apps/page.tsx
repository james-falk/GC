import Link from 'next/link';

// Pay Apps tab — list view. See gc-wireframes-brief.md § Screen 7 (review)
// and § Screen 9 (owner pay app preview).
//
// Phase B scope: shows one mocked sub-pay-app in 'submitted' status so the
// review flow has something to click into. Real data lands when pay-app
// persistence + sub-portal submission are wired.

type PageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  needs_revision: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-emerald-100 text-emerald-800',
};

export default async function ProjectPayAppsPage({ params }: PageProps) {
  const { id: projectId } = await params;

  const mockPayApps = [
    {
      id: 'mock-payapp-1',
      direction: 'sub_to_gc' as const,
      contractor: 'Brothers & Bricks Masonry',
      period: 'March 2026',
      status: 'submitted',
      submittedAt: 'Mar 31, 2026',
      total: 268313.3,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Pay Apps</h2>
        <p className="text-sm text-slate-600">
          Sub → GC submissions awaiting review, plus GC → Owner pay apps for
          this period.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Direction
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                From / To
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Period
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Total $
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {mockPayApps.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="border-b border-slate-100 px-4 py-3 text-xs uppercase tracking-wide text-slate-600">
                  Sub → GC
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm">
                  <Link
                    href={`/projects/${projectId}/pay-apps/${p.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {p.contractor}
                  </Link>
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                  {p.period}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums">
                  ${p.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-700')
                    }
                  >
                    {p.status}
                  </span>
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                  {p.submittedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Mocked entry — real pay-app records light up here once sub-portal
        submission is wired.
      </p>
    </div>
  );
}
