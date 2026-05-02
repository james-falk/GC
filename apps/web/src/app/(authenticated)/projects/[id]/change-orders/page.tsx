import Link from 'next/link';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { approveChangeOrder } from './actions';

// Change Orders tab — real list scoped to this project. See gc-wireframes-brief.md
// § Screen 8.
//
// Wedge feature: each draft CO has an Approve button that fires the atomic
// propagation transaction. On success, the affected subcontract's
// current_amount + each affected SoV line's current_amount jump in lockstep
// with the new approved status — all-or-nothing.

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

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectChangeOrdersPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  // Read each CO joined to its (optional) affected subcontract +
  // subcontractor for display.
  const cos = await db
    .select({
      id: schema.changeOrders.id,
      coNumber: schema.changeOrders.coNumber,
      description: schema.changeOrders.description,
      totalAmount: schema.changeOrders.totalAmount,
      status: schema.changeOrders.status,
      approvedAt: schema.changeOrders.approvedAt,
      createdAt: schema.changeOrders.createdAt,
      affectedSubcontractContractNumber: schema.subcontracts.contractNumber,
      affectedSubcontractorName: schema.subcontractors.name,
    })
    .from(schema.changeOrders)
    .leftJoin(
      schema.subcontracts,
      eq(schema.changeOrders.affectedSubcontractId, schema.subcontracts.id),
    )
    .leftJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.changeOrders.projectId, projectId),
        eq(schema.changeOrders.tenantId, tenant.id),
      ),
    )
    .orderBy(desc(schema.changeOrders.createdAt), asc(schema.changeOrders.coNumber));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Change Orders</h2>
          <p className="text-sm text-slate-600">
            Draft &rarr; architect &rarr; owner. On approval the system updates
            the affected subcontract and SoV lines atomically.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/change-orders/new`}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          + Draft change order
        </Link>
      </div>

      {cos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">No change orders yet.</p>
          <Link
            href={`/projects/${projectId}/change-orders/new`}
            className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Draft your first change order
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
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
                <th className="border-b border-slate-200 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {cos.map((co) => {
                const total = Number(co.totalAmount);
                const sign = total > 0 ? '+' : total < 0 ? '-' : '';
                const totalDisplay = `${sign}$${formatMoney(Math.abs(total))}`;
                return (
                  <tr key={co.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2.5 font-medium text-slate-900">
                      {co.coNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-800">
                      {co.description}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">
                      {co.affectedSubcontractContractNumber ? (
                        <>
                          <span className="font-medium">
                            {co.affectedSubcontractContractNumber}
                          </span>{' '}
                          <span className="text-xs text-slate-500">
                            {co.affectedSubcontractorName}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={
                        'border-b border-slate-100 px-3 py-2.5 text-right tabular-nums font-medium ' +
                        (total > 0
                          ? 'text-emerald-700'
                          : total < 0
                            ? 'text-red-700'
                            : 'text-slate-400')
                      }
                    >
                      {totalDisplay}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (STATUS_STYLES[co.status] ?? 'bg-slate-100 text-slate-700')
                        }
                      >
                        {co.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right">
                      {co.status === 'draft' ? (
                        <form action={approveChangeOrder} className="inline">
                          <input type="hidden" name="changeOrderId" value={co.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <button
                            type="submit"
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            title="Approve and propagate to subcontract + SoV (MVP demo path)"
                          >
                            Approve &amp; propagate
                          </button>
                        </form>
                      ) : co.status === 'approved' ? (
                        <span className="text-xs text-slate-500">
                          Propagated{' '}
                          {co.approvedAt
                            ? new Date(co.approvedAt).toLocaleDateString()
                            : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cos.some((c) => c.status === 'draft') && (
        <p className="text-xs text-slate-500">
          The Approve &amp; propagate button is the MVP demo path —
          it skips the Principal &rarr; Architect &rarr; Owner magic-link
          chain and approves directly. The atomic propagation transaction
          (subcontract.current_amount + every affected SoV line +
          approval_event audit row) is real.
        </p>
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
