import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { addSovLine } from './actions';

// SoV editor — display table + add-line form. Default tab on the project
// detail page. See gc-wireframes-brief.md § Screen 4.
//
// Step 3 of the backend persistence pass:
//   - Each row joins through to its (optional) subcontract + subcontractor
//     for the chip in the Subcontractor column.
//   - Add-line form gets an optional subcontract dropdown. Empty value
//     means GC-internal cost line (bonding, permits, OH&P, etc.).
// Still deferred: parent/child hierarchy, inline edit, drift indicator,
// retention/stored-materials columns, "Import from contract".

const inputClass =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectSovPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  // Lines for the table — left-join to subcontracts + subcontractors so we
  // can render a "subcontractor name" chip when the line points at one.
  const lines = await db
    .select({
      id: schema.sovLines.id,
      lineNumber: schema.sovLines.lineNumber,
      description: schema.sovLines.description,
      contractAmount: schema.sovLines.contractAmount,
      currentAmount: schema.sovLines.currentAmount,
      subcontractId: schema.sovLines.subcontractId,
      subcontractorName: schema.subcontractors.name,
    })
    .from(schema.sovLines)
    .leftJoin(
      schema.subcontracts,
      eq(schema.sovLines.subcontractId, schema.subcontracts.id),
    )
    .leftJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.sovLines.projectId, projectId),
        eq(schema.sovLines.tenantId, tenant.id),
      ),
    )
    .orderBy(asc(schema.sovLines.lineNumber));

  // Subcontracts for this project, for the add-line dropdown.
  const projectSubcontracts = await db
    .select({
      id: schema.subcontracts.id,
      contractNumber: schema.subcontracts.contractNumber,
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

  const totals = lines.reduce(
    (acc, l) => ({
      contract: acc.contract + Number(l.contractAmount),
      current: acc.current + Number(l.currentAmount),
    }),
    { contract: 0, current: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Schedule of Values</h2>
          <p className="text-sm text-slate-600">
            {lines.length === 0
              ? 'No line items yet — add the first one below.'
              : `${lines.length} line${lines.length === 1 ? '' : 's'}.`}
          </p>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Line #
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Subcontractor
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Original $
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current $
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 tabular-nums">
                    {l.lineNumber}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">{l.description}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    {l.subcontractorName ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {l.subcontractorName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">GC-internal</span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums">
                    ${formatMoney(l.contractAmount)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums">
                    ${formatMoney(l.currentAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-sm font-medium">
                <td className="px-4 py-3" colSpan={3}>
                  Totals
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ${formatMoneyNumber(totals.contract)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ${formatMoneyNumber(totals.current)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Add line</h3>
        <form action={addSovLine} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="sm:col-span-2">
            <label htmlFor="lineNumber" className="block text-xs font-medium text-slate-700">
              Line #
            </label>
            <input
              id="lineNumber"
              name="lineNumber"
              required
              maxLength={32}
              placeholder="1"
              className={inputClass + ' mt-1'}
            />
          </div>

          <div className="sm:col-span-5">
            <label htmlFor="description" className="block text-xs font-medium text-slate-700">
              Description
            </label>
            <input
              id="description"
              name="description"
              required
              maxLength={500}
              placeholder="e.g. Site work"
              className={inputClass + ' mt-1'}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="subcontractId" className="block text-xs font-medium text-slate-700">
              Subcontract
            </label>
            <select
              id="subcontractId"
              name="subcontractId"
              defaultValue=""
              className={inputClass + ' mt-1'}
            >
              <option value="">GC-internal</option>
              {projectSubcontracts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.contractNumber} — {s.subcontractorName}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="contractAmount" className="block text-xs font-medium text-slate-700">
              Contract amount
            </label>
            <input
              id="contractAmount"
              name="contractAmount"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              className={inputClass + ' mt-1'}
            />
          </div>

          <div className="flex items-end sm:col-span-1">
            <button
              type="submit"
              className="w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatMoney(value: string) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyNumber(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
