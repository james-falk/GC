import Link from 'next/link';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Cross-project Change Orders queue. Tenant-scoped list of every CO
// across every active project. Click any row to open the per-project
// CO list with that CO highlighted.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_principal: 'bg-amber-100 text-amber-800',
  pending_architect: 'bg-amber-100 text-amber-800',
  pending_owner: 'bg-amber-100 text-amber-800',
  architect_rejected: 'bg-red-100 text-red-800',
  owner_rejected: 'bg-red-100 text-red-800',
  approved: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-700',
};

const FILTERS: Array<{ value: string; label: string; statuses?: string[] }> = [
  { value: 'all', label: 'All' },
  {
    value: 'in_chain',
    label: 'In approval chain',
    statuses: ['pending_principal', 'pending_architect', 'pending_owner'],
  },
  { value: 'draft', label: 'Drafts', statuses: ['draft'] },
  { value: 'approved', label: 'Approved', statuses: ['approved'] },
  {
    value: 'rejected',
    label: 'Rejected',
    statuses: ['architect_rejected', 'owner_rejected'],
  },
];

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function GlobalChangeOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter = sp.filter ?? 'all';
  const tenant = await getCurrentTenant();

  const rows = await db
    .select({
      id: schema.changeOrders.id,
      coNumber: schema.changeOrders.coNumber,
      description: schema.changeOrders.description,
      totalAmount: schema.changeOrders.totalAmount,
      status: schema.changeOrders.status,
      approvedAt: schema.changeOrders.approvedAt,
      createdAt: schema.changeOrders.createdAt,
      projectId: schema.changeOrders.projectId,
      projectName: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
      affectedSubcontractContractNumber: schema.subcontracts.contractNumber,
      affectedSubcontractorName: schema.subcontractors.name,
    })
    .from(schema.changeOrders)
    .innerJoin(
      schema.projects,
      and(
        eq(schema.changeOrders.projectId, schema.projects.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .leftJoin(
      schema.subcontracts,
      eq(schema.changeOrders.affectedSubcontractId, schema.subcontracts.id),
    )
    .leftJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(eq(schema.changeOrders.tenantId, tenant.id))
    .orderBy(desc(schema.changeOrders.createdAt), asc(schema.changeOrders.coNumber));

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Change Orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every CO across every active project. The per-project view handles
          drafting + the approval chain — click into any row to continue.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Link
              key={f.value}
              href={
                f.value === 'all' ? '/change-orders' : `/change-orders?filter=${f.value}`
              }
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
              ? 'No change orders in this tenant yet.'
              : `No COs match the "${filter}" filter.`}
          </p>
          {rows.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Open a project and draft your first change order from its Change
              Orders tab.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Project
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  CO #
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Affects
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total $
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const total = Number(c.totalAmount);
                const sign = total > 0 ? '+' : total < 0 ? '-' : '';
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <Link
                        href={`/projects/${c.projectId}/change-orders`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {c.projectName}
                      </Link>
                      <div className="text-[11px] text-slate-500">
                        #{c.projectNumber}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 font-mono text-xs">
                      {c.coNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-800">
                      {c.description}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">
                      {c.affectedSubcontractorName ? (
                        <>
                          {c.affectedSubcontractorName}
                          {c.affectedSubcontractContractNumber && (
                            <span className="ml-1.5 text-[11px] text-slate-500">
                              {c.affectedSubcontractContractNumber}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={
                        'border-b border-slate-100 px-3 py-2.5 text-right tabular-nums font-semibold ' +
                        (total > 0
                          ? 'text-emerald-700'
                          : total < 0
                            ? 'text-red-700'
                            : 'text-slate-400')
                      }
                    >
                      {sign}${formatMoney(Math.abs(total))}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (STATUS_STYLES[c.status] ?? 'bg-slate-100 text-slate-700')
                        }
                      >
                        {c.status}
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

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
