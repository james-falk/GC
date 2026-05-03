import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { getDriftAlertsForTenant, SEVERITY_STYLES } from '@/lib/drift';

// Drift detail. See gc-wireframes-brief.md § Screen 12.
// Three sections: what's wrong (plain English), where the data is (links to
// offending entities), how to fix (action buttons). Right column shows the
// detection timeline.
//
// Re-runs the invariants on every visit and looks up the alert by id.
// (No persistent drift_alerts table — alerts are computed live.)

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DriftDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  // Alert ids are URL-encoded by Next.js; decode for the comparison.
  const id = decodeURIComponent(rawId);
  const tenant = await getCurrentTenant();
  const alerts = await getDriftAlertsForTenant(tenant.id);
  const alert = alerts.find((a) => a.id === id);
  if (!alert) notFound();

  const sev = SEVERITY_STYLES[alert.severity];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/drift"
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← All drift alerts
        </Link>
      </div>

      {/* Header */}
      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-2 h-3 w-3 shrink-0 rounded-full ${sev.dot}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sev.chip}`}
              >
                {sev.label} severity
              </span>
              <span className="text-xs text-slate-500">
                Detected {alert.detectedAt}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              {alert.typeLabel}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Project #{alert.projectNumber} — {alert.projectName}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          {/* What's wrong */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              What&rsquo;s wrong
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-800">
              {alert.whatsWrong}
            </p>
          </section>

          {/* Where the data is */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Where the data is
            </h2>
            <ul className="mt-3 space-y-2">
              {alert.whereTheData.map((d) => (
                <li key={d.label}>
                  <Link
                    href={d.href}
                    className="inline-flex items-center gap-1 text-sm text-blue-700 transition hover:text-blue-800 hover:underline"
                  >
                    {d.label}
                    <span aria-hidden className="text-xs">↗</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* How to fix */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              How to fix
            </h2>
            <div className="mt-4 space-y-3">
              {alert.howToFix.map((fix, idx) => (
                <div
                  key={fix.label}
                  className={
                    'rounded-md border p-4 ' +
                    (fix.primary
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white')
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div
                        className={
                          'text-sm font-medium ' +
                          (fix.primary ? 'text-blue-900' : 'text-slate-900')
                        }
                      >
                        {fix.label}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {fix.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled
                      className={
                        'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ' +
                        (fix.primary
                          ? 'bg-blue-700 text-white opacity-60'
                          : 'border border-slate-300 bg-white text-slate-400')
                      }
                    >
                      {idx === 0 ? 'Take action' : 'Apply'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Fix actions are wired in a later session — for now this is a
              clickable mock so the resolution paths are visible.
            </p>
          </section>
        </div>

        {/* Right column: timeline */}
        <aside className="lg:col-span-1">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              History
            </h2>
            <ol className="mt-4 space-y-4">
              {alert.history.map((h, idx) => {
                const isLast = idx === alert.history.length - 1;
                return (
                  <li key={`${h.at}-${idx}`} className="relative flex gap-3">
                    {!isLast && (
                      <span
                        aria-hidden
                        className="absolute left-[5px] top-3 h-[calc(100%+0.75rem)] w-px bg-slate-200"
                      />
                    )}
                    <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-slate-300 ring-1 ring-slate-300" />
                    <div>
                      <div className="text-xs font-medium text-slate-700">{h.at}</div>
                      <div className="text-xs text-slate-500">{h.note}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
