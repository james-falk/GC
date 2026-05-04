import Link from 'next/link';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Cross-project Pay Apps queue. Tenant-scoped list of every pay
// application across every active (non-archived) project.
//
// The per-project view (/projects/[id]/pay-apps) handles the actual
// workflow — this page is a router and a queue. Click any row to jump
// straight into the per-project flow with the right pay-app loaded.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  needs_revision: 'bg-orange-100 text-orange-800',
  approved_by_pm: 'bg-emerald-100 text-emerald-800',
  approved_by_principal: 'bg-emerald-100 text-emerald-800',
  approved: 'bg-emerald-100 text-emerald-800',
  included_in_owner_pay_app: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-200 text-emerald-900',
  cancelled: 'bg-slate-200 text-slate-700',
  generated: 'bg-blue-100 text-blue-800',
  signed: 'bg-blue-100 text-blue-800',
  notarized: 'bg-blue-100 text-blue-800',
  sent_to_architect: 'bg-amber-100 text-amber-800',
  architect_approved: 'bg-emerald-100 text-emerald-800',
  sent_to_owner: 'bg-amber-100 text-amber-800',
  owner_approved: 'bg-emerald-100 text-emerald-800',
  owner_rejected: 'bg-red-100 text-red-800',
  architect_rejected: 'bg-red-100 text-red-800',
};

// Status filter chips. "Awaiting" is the high-frequency cut Riley-the-
// office-manager wants first thing in the morning.
const FILTERS: Array<{ value: string; label: string; statuses?: string[] }> = [
  { value: 'all', label: 'All' },
  {
    value: 'awaiting',
    label: 'Awaiting review',
    statuses: ['submitted', 'sent_to_owner'],
  },
  {
    value: 'approved',
    label: 'Approved',
    statuses: ['approved', 'owner_approved', 'included_in_owner_pay_app'],
  },
  { value: 'paid', label: 'Paid', statuses: ['paid'] },
  {
    value: 'rejected',
    label: 'Rejected',
    statuses: ['needs_revision', 'owner_rejected', 'architect_rejected'],
  },
];

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function GlobalPayAppsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter = sp.filter ?? 'all';
  const tenant = await getCurrentTenant();

  const rows = await db
    .select({
      id: schema.payApplications.id,
      direction: schema.payApplications.direction,
      status: schema.payApplications.status,
      periodStart: schema.payApplications.periodStart,
      periodEnd: schema.payApplications.periodEnd,
      submittedAt: schema.payApplications.submittedAt,
      totalBilled: schema.payApplications.totalBilled,
      projectId: schema.payApplications.projectId,
      projectName: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
      subcontractorName: schema.subcontractors.name,
      contractNumber: schema.subcontracts.contractNumber,
    })
    .from(schema.payApplications)
    .innerJoin(
      schema.projects,
      and(
        eq(schema.payApplications.projectId, schema.projects.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .leftJoin(
      schema.subcontracts,
      eq(schema.payApplications.subcontractId, schema.subcontracts.id),
    )
    .leftJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(eq(schema.payApplications.tenantId, tenant.id))
    .orderBy(
      desc(schema.payApplications.periodStart),
      asc(schema.projects.projectNumber),
    );

  const filtered = (() => {
    const f = FILTERS.find((x) => x.value === filter);
    if (!f || !f.statuses) return rows;
    return rows.filter((r) => f.statuses!.includes(r.status));
  })();

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f.value,
      f.statuses
        ? rows.filter((r) => f.statuses!.includes(r.status)).length
        : rows.length,
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pay Apps</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every pay application across every active project. The per-project
            view handles the actual review flow — click into any row to
            continue.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'all' ? '/pay-apps' : `/pay-apps?filter=${f.value}`}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                (active
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              {f.label}
              <span className="ml-1.5 tabular-nums text-[10px] text-slate-500">
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">
            {rows.length === 0
              ? 'No pay apps in this tenant yet.'
              : `No pay apps match the "${filter}" filter.`}
          </p>
          {rows.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Open a project and start a monthly pay-app cycle from its Pay Apps tab.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Project
                </th>
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const linkHref =
                  p.direction === 'sub_to_gc'
                    ? `/projects/${p.projectId}/pay-apps/${p.id}`
                    : `/projects/${p.projectId}/pay-apps/aia?payAppId=${p.id}`;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-4 py-3 text-sm">
                      <Link
                        href={linkHref}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {p.projectName}
                      </Link>
                      <div className="text-[11px] text-slate-500">
                        #{p.projectNumber}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-xs uppercase tracking-wide text-slate-600">
                      {p.direction === 'sub_to_gc' ? 'Sub → GC' : 'GC → Owner'}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm">
                      {p.direction === 'sub_to_gc' ? (
                        <>
                          <div className="text-slate-900">
                            {p.subcontractorName ?? 'Unknown sub'}
                          </div>
                          {p.contractNumber && (
                            <div className="text-[11px] text-slate-500">
                              {p.contractNumber}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-700">Owner pay app</span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                      {formatPeriod(p.periodStart, p.periodEnd)}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums">
                      ${formatMoney(p.totalBilled)}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatMoney(value: string) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return s.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}
