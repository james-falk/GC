import Link from 'next/link';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { resolveBaseUrl } from '@/lib/magic-link';
import {
  approveChangeOrder,
  principalApproveCoAction,
  sendApprovalLink,
  submitCoToPrincipalAction,
} from './actions';

// Change Orders tab — real list scoped to this project.
// See gc-wireframes-brief.md § Screen 8.
//
// Two approval paths from this page:
//   1. PM-direct "Approve & propagate" — dev shortcut bypassing the
//      magic-link chain. Triggers the atomic propagation transaction.
//   2. "Send approval link" — generates a single-use magic-link with the
//      target owner's email; CO transitions to pending_owner. The owner
//      clicks the link, lands on /approve/[token], approves there. Same
//      atomic propagation runs on the consumer side.

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
  searchParams: Promise<{ token?: string; coId?: string }>;
};

export default async function ProjectChangeOrdersPage({
  params,
  searchParams,
}: PageProps) {
  const { id: projectId } = await params;
  const { token, coId } = await searchParams;
  const tenant = await getCurrentTenant();

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

  // Banner content for a freshly-generated magic-link URL. We don't store
  // raw tokens (only their SHA-256 hashes), so this is the only moment the
  // URL is recoverable. If the user navigates away they need to re-send to
  // regenerate; the old link stays valid until consumed or expired.
  const bannerUrl =
    token && coId && /^[a-f0-9]{64}$/.test(token)
      ? `${resolveBaseUrl()}/approve/${token}`
      : null;

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

      {bannerUrl && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-medium">Approval link generated.</div>
          <div className="mt-1 text-xs text-emerald-800">
            Single-use, valid for 72 hours. Send this URL to the owner — or
            click it yourself to demo the consumer flow.
          </div>
          <div className="mt-2 break-all rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-800">
            {bannerUrl}
          </div>
          <div className="mt-2 text-[11px] text-emerald-700">
            We don&rsquo;t store raw tokens — only a hash. If you navigate
            away, re-send the link to regenerate it. Email delivery (Resend)
            lands later.
          </div>
        </div>
      )}

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
                  <tr key={co.id} className="align-top hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      {co.coNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-800">
                      {co.description}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
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
                        'border-b border-slate-100 px-3 py-3 text-right tabular-nums font-medium ' +
                        (total > 0
                          ? 'text-emerald-700'
                          : total < 0
                            ? 'text-red-700'
                            : 'text-slate-400')
                      }
                    >
                      {totalDisplay}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (STATUS_STYLES[co.status] ?? 'bg-slate-100 text-slate-700')
                        }
                      >
                        {co.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right">
                      {co.status === 'draft' && (
                        <div className="flex flex-col items-end gap-2">
                          <form action={submitCoToPrincipalAction} className="inline">
                            <input type="hidden" name="changeOrderId" value={co.id} />
                            <input type="hidden" name="projectId" value={projectId} />
                            <button
                              type="submit"
                              className="rounded-md bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-800"
                              title="Submit to Principal for in-app approval"
                            >
                              Submit to Principal
                            </button>
                          </form>
                          <details className="text-right">
                            <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-600">
                              dev shortcuts
                            </summary>
                            <div className="mt-1 flex flex-col gap-1">
                              <form
                                action={sendApprovalLink}
                                className="flex items-center gap-2"
                              >
                                <input type="hidden" name="changeOrderId" value={co.id} />
                                <input type="hidden" name="projectId" value={projectId} />
                                <input
                                  type="email"
                                  name="recipientEmail"
                                  required
                                  placeholder="owner@example.com"
                                  className="block w-44 rounded border border-slate-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 transition hover:bg-slate-50"
                                  title="Skip Principal + Architect, send straight to owner"
                                >
                                  → owner
                                </button>
                              </form>
                              <form action={approveChangeOrder}>
                                <input type="hidden" name="changeOrderId" value={co.id} />
                                <input type="hidden" name="projectId" value={projectId} />
                                <button
                                  type="submit"
                                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                                  title="Skip the chain entirely (PM-direct propagation)"
                                >
                                  approve directly
                                </button>
                              </form>
                            </div>
                          </details>
                        </div>
                      )}
                      {co.status === 'pending_principal' && (
                        <form action={principalApproveCoAction} className="inline">
                          <input type="hidden" name="changeOrderId" value={co.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <button
                            type="submit"
                            className="rounded-md bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-800"
                            title="Principal approves; magic-link generated for architect"
                          >
                            Principal approve
                          </button>
                        </form>
                      )}
                      {co.status === 'pending_architect' && (
                        <span className="text-xs text-slate-600">
                          Awaiting architect approval
                        </span>
                      )}
                      {co.status === 'pending_owner' && (
                        <span className="text-xs text-slate-600">
                          Awaiting owner approval
                        </span>
                      )}
                      {co.status === 'approved' && (
                        <span className="text-xs text-slate-500">
                          Propagated{' '}
                          {co.approvedAt
                            ? new Date(co.approvedAt).toLocaleDateString()
                            : ''}
                        </span>
                      )}
                      {co.status === 'architect_rejected' && (
                        <span className="text-xs text-red-700">
                          Rejected by architect
                        </span>
                      )}
                      {co.status === 'owner_rejected' && (
                        <span className="text-xs text-red-700">
                          Rejected by owner
                        </span>
                      )}
                      {co.status === 'cancelled' && (
                        <span className="text-xs text-slate-400">cancelled</span>
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
          The magic-link path (Send link &rarr; owner approves at /approve)
          is the real flow. The Principal &rarr; Architect intermediate
          steps land when the rest of the chain is wired. Approve-directly
          is a dev shortcut that skips the link entirely.
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
