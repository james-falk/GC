import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { addSovLine } from './actions';

// SoV editor — display table + add-line form. Default tab on the project
// detail page. See gc-wireframes-brief.md § Screen 4.
//
// Parent/child hierarchy: top-level lines (parent_line_id IS NULL) appear
// at the top level; their children render indented underneath. Single-level
// nesting only — matches Spartan's "3" → "3a/3b/3c" pattern.
//
// To add a child line, click "+ Add child" on a parent row. The URL gets
// ?addChildOf=<parentId> and the add-line form pre-fills its hidden
// parentLineId. Cancel by navigating back to the base tab URL.

const inputClass =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

type SovLineRow = {
  id: string;
  lineNumber: string;
  description: string;
  contractAmount: string;
  currentAmount: string;
  subcontractId: string | null;
  parentLineId: string | null;
  subcontractorName: string | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ addChildOf?: string }>;
};

export default async function ProjectSovPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const { addChildOf } = await searchParams;
  const tenant = await getCurrentTenant();

  // Lines for the table — left-join to subcontracts + subcontractors so we
  // can render a "subcontractor name" chip when the line points at one.
  const lines: SovLineRow[] = await db
    .select({
      id: schema.sovLines.id,
      lineNumber: schema.sovLines.lineNumber,
      description: schema.sovLines.description,
      contractAmount: schema.sovLines.contractAmount,
      currentAmount: schema.sovLines.currentAmount,
      subcontractId: schema.sovLines.subcontractId,
      parentLineId: schema.sovLines.parentLineId,
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

  // Group children under parents in a single pass.
  const parents = lines.filter((l) => l.parentLineId === null);
  const childrenByParent = new Map<string, SovLineRow[]>();
  for (const l of lines) {
    if (l.parentLineId !== null) {
      const arr = childrenByParent.get(l.parentLineId) ?? [];
      arr.push(l);
      childrenByParent.set(l.parentLineId, arr);
    }
  }

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

  // Resolve parent context if "+ Add child" was clicked. We need the parent
  // line's metadata for the form heading + we silently strip the param if
  // it doesn't belong to this project (defense against URL tampering).
  const addChildParent =
    addChildOf && parents.find((p) => p.id === addChildOf)
      ? (parents.find((p) => p.id === addChildOf) as SovLineRow)
      : null;

  // Totals only count parent lines so children don't double-count.
  const totals = parents.reduce(
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
              : `${parents.length} top-level line${parents.length === 1 ? '' : 's'}, ${lines.length - parents.length} child line${lines.length - parents.length === 1 ? '' : 's'}.`}
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
                <th className="border-b border-slate-200 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => {
                const kids = childrenByParent.get(p.id) ?? [];
                return (
                  <Fragment key={p.id} parent={p} kids={kids} projectId={projectId} />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-sm font-medium">
                <td className="px-4 py-3" colSpan={3}>
                  Totals (parents only)
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ${formatMoneyNumber(totals.contract)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ${formatMoneyNumber(totals.current)}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {addChildParent
              ? `Add child line under "${addChildParent.lineNumber} — ${addChildParent.description}"`
              : 'Add line'}
          </h3>
          {addChildParent && (
            <Link
              href={`/projects/${projectId}`}
              className="text-xs text-slate-600 transition hover:text-slate-900"
            >
              Cancel — add a top-level line
            </Link>
          )}
        </div>
        <form action={addSovLine} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
          <input type="hidden" name="projectId" value={projectId} />
          {addChildParent && (
            <input type="hidden" name="parentLineId" value={addChildParent.id} />
          )}

          <div className="sm:col-span-2">
            <label htmlFor="lineNumber" className="block text-xs font-medium text-slate-700">
              Line #
            </label>
            <input
              id="lineNumber"
              name="lineNumber"
              required
              maxLength={32}
              placeholder={addChildParent ? `${addChildParent.lineNumber}a` : '1'}
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
              defaultValue={addChildParent?.subcontractId ?? ''}
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

function Fragment({
  parent,
  kids,
  projectId,
}: {
  parent: SovLineRow;
  kids: SovLineRow[];
  projectId: string;
}) {
  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums">
          {parent.lineNumber}
        </td>
        <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">
          {parent.description}
        </td>
        <td className="border-b border-slate-100 px-4 py-3 text-sm">
          {parent.subcontractorName ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {parent.subcontractorName}
            </span>
          ) : (
            <span className="text-xs text-slate-400">GC-internal</span>
          )}
        </td>
        <td className="border-b border-slate-100 px-4 py-3 text-right text-sm font-medium tabular-nums">
          ${formatMoney(parent.contractAmount)}
        </td>
        <td className="border-b border-slate-100 px-4 py-3 text-right text-sm font-medium tabular-nums">
          ${formatMoney(parent.currentAmount)}
        </td>
        <td className="border-b border-slate-100 px-4 py-3 text-right">
          <Link
            href={`/projects/${projectId}?addChildOf=${parent.id}`}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            + Add child
          </Link>
        </td>
      </tr>
      {kids.map((c) => (
        <tr key={c.id} className="bg-slate-50/40 hover:bg-slate-50">
          <td className="border-b border-slate-100 py-2 pl-10 pr-4 text-xs text-slate-600 tabular-nums">
            {c.lineNumber}
          </td>
          <td className="border-b border-slate-100 px-4 py-2 text-sm text-slate-700">
            {c.description}
          </td>
          <td className="border-b border-slate-100 px-4 py-2 text-sm">
            {c.subcontractorName ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {c.subcontractorName}
              </span>
            ) : (
              <span className="text-xs text-slate-400">GC-internal</span>
            )}
          </td>
          <td className="border-b border-slate-100 px-4 py-2 text-right text-sm tabular-nums text-slate-700">
            ${formatMoney(c.contractAmount)}
          </td>
          <td className="border-b border-slate-100 px-4 py-2 text-right text-sm tabular-nums text-slate-700">
            ${formatMoney(c.currentAmount)}
          </td>
          <td className="border-b border-slate-100 px-4 py-2"></td>
        </tr>
      ))}
    </>
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
