import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Subs tab — real subcontract list scoped to this project. Tenant-scoped
// query joins subcontracts to subcontractors. See gc-wireframes-brief.md
// § Screen 5 (list view).
//
// Step 1 of the backend persistence pass:
//   - Replace the prior mocked list with a real query.
//   - "Add subcontract" button stays disabled — wired in step 2 of the pass.
//   - Billed-to-date is $0 across the board until pay-applications persist
//     (later step). CO impact (currentAmount - originalAmount) is computed
//     here; it'll be non-zero once approved COs propagate.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectSubsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  const rows = await db
    .select({
      id: schema.subcontracts.id,
      contractNumber: schema.subcontracts.contractNumber,
      originalAmount: schema.subcontracts.originalAmount,
      currentAmount: schema.subcontracts.currentAmount,
      status: schema.subcontracts.status,
      subcontractorName: schema.subcontractors.name,
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.subcontracts.projectId, projectId),
        eq(schema.subcontracts.tenantId, tenant.id),
      ),
    )
    .orderBy(asc(schema.subcontracts.contractNumber));

  const totals = rows.reduce(
    (acc, r) => {
      const original = Number(r.originalAmount);
      const current = Number(r.currentAmount);
      return {
        original: acc.original + original,
        cos: acc.cos + (current - original),
        current: acc.current + current,
      };
    },
    { original: 0, cos: 0, current: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Subcontracts</h2>
          <p className="text-sm text-slate-600">
            All subs on this project. Billed-to-date will reflect approved sub
            pay-app totals once pay-application persistence ships; balance =
            current contract minus billed.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white opacity-60"
          title="Coming in the next step of the backend pass"
        >
          + Add subcontract
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            No subcontracts on this project yet.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            The &ldquo;Add subcontract&rdquo; form lands in the next step of the
            backend persistence pass.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Subcontractor
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Contract #
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Original $
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  COs $
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current $
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Billed to date
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Balance
                </th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const original = Number(r.originalAmount);
                const current = Number(r.currentAmount);
                const cosImpact = current - original;
                const billed = 0; // wired when pay-apps persist
                const balance = current - billed;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <div className="font-medium text-slate-900">
                        {r.subcontractorName}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">
                      {r.contractNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                      ${formatMoney(original)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">
                      {cosImpact === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className="text-emerald-700">
                          +${formatMoney(cosImpact)}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums font-medium">
                      ${formatMoney(current)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                      ${formatMoney(billed)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                      ${formatMoney(balance)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-700')
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-sm font-medium">
                <td className="px-3 py-2.5" colSpan={2}>
                  Totals
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  ${formatMoney(totals.original)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                  {totals.cos === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <>+${formatMoney(totals.cos)}</>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  ${formatMoney(totals.current)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">$0.00</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  ${formatMoney(totals.current)}
                </td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tfoot>
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
