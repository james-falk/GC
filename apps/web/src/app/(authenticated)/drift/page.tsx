import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';
import { getDriftAlertsForTenant, SEVERITY_STYLES } from '@/lib/drift';

// Drift Dashboard. See gc-wireframes-brief.md § Screen 2 (Drift Alerts panel)
// and § Screen 12 (detail view, behind each row).
//
// Real drift detection: runs every invariant in @constructor/domain against
// the tenant's live data on every page load. Empty list = system is
// reconciled; populated list = something needs human attention.

export default async function DriftDashboardPage() {
  const tenant = await getCurrentTenant();
  const alerts = await getDriftAlertsForTenant(tenant.id);
  const highCount = alerts.filter((a) => a.severity === 'high').length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Drift Alerts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Conditions where the system&rsquo;s data has diverged from itself —
          subs billed above their ceiling, COs approved but not propagated,
          period rollups that don&rsquo;t reconcile. Each alert links to the
          offending records and offers one-click resolution paths.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total alerts" value={alerts.length.toString()} />
        <StatCard
          label="High severity"
          value={highCount.toString()}
          accent={highCount > 0 ? 'red' : 'slate'}
        />
        <StatCard label="Last scan" value="2 hours ago" />
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm font-medium text-slate-700">All clear.</p>
          <p className="mt-1 text-xs text-slate-500">No drift detected.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => {
            const sev = SEVERITY_STYLES[a.severity];
            return (
              <li
                key={a.id}
                className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sev.chip}`}
                      >
                        {sev.label}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {a.typeLabel}
                      </span>
                      <span className="text-xs text-slate-500">
                        Project #{a.projectNumber} — {a.projectName}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{a.brief}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Detected {a.detectedAt}
                      </span>
                      <Link
                        href={`/drift/${a.id}`}
                        className="text-xs font-medium text-blue-700 transition hover:text-blue-800"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: string;
  accent?: 'slate' | 'red';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (accent === 'red' ? 'text-red-700' : 'text-slate-900')
        }
      >
        {value}
      </div>
    </div>
  );
}
