import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { updateSubcontract } from '../../actions';

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
] as const;

type PageProps = {
  params: Promise<{ id: string; subId: string }>;
};

export default async function EditSubcontractPage({ params }: PageProps) {
  const { id: projectId, subId } = await params;
  const tenant = await getCurrentTenant();

  const [sub] = await db
    .select({
      id: schema.subcontracts.id,
      contractNumber: schema.subcontracts.contractNumber,
      originalAmount: schema.subcontracts.originalAmount,
      currentAmount: schema.subcontracts.currentAmount,
      status: schema.subcontracts.status,
      inclusions: schema.subcontracts.inclusions,
      exclusions: schema.subcontracts.exclusions,
      subcontractorName: schema.subcontractors.name,
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .innerJoin(
      schema.projects,
      and(
        eq(schema.subcontracts.projectId, schema.projects.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .where(
      and(
        eq(schema.subcontracts.id, subId),
        eq(schema.subcontracts.projectId, projectId),
        eq(schema.subcontracts.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!sub) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Edit subcontract</h2>
          <p className="text-sm text-slate-600">
            {sub.subcontractorName} · contract {sub.contractNumber}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/subs`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        <strong>Note:</strong> Original and current contract amounts can&rsquo;t
        be edited here. Use a change order to adjust the contract value — that
        keeps the audit trail intact and propagates to SoV lines atomically.
      </div>

      <form action={updateSubcontract} className="max-w-xl space-y-5">
        <input type="hidden" name="subcontractId" value={sub.id} />
        <input type="hidden" name="projectId" value={projectId} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Original $ (read-only)
            </label>
            <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-700">
              ${formatMoney(sub.originalAmount)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Current $ (read-only)
            </label>
            <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-700">
              ${formatMoney(sub.currentAmount)}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="contractNumber" className="block text-sm font-medium text-slate-700">
            Contract number
          </label>
          <input
            id="contractNumber"
            name="contractNumber"
            required
            maxLength={64}
            defaultValue={sub.contractNumber}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={sub.status}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Active subs receive monthly pay-app links. Closed subs don&rsquo;t.
          </p>
        </div>

        <div>
          <label htmlFor="inclusions" className="block text-sm font-medium text-slate-700">
            Inclusions
          </label>
          <textarea
            id="inclusions"
            name="inclusions"
            rows={3}
            maxLength={4000}
            defaultValue={sub.inclusions ?? ''}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="exclusions" className="block text-sm font-medium text-slate-700">
            Exclusions
          </label>
          <textarea
            id="exclusions"
            name="exclusions"
            rows={3}
            maxLength={4000}
            defaultValue={sub.exclusions ?? ''}
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href={`/projects/${projectId}/subs`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function formatMoney(value: string): string {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
