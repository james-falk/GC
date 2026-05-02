import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { createSubcontract } from '../actions';

// Subcontract create form. Minimal fields: subcontractor (dropdown from
// directory), contract number, original amount, status. Defer spec sections,
// inclusions, exclusions, signed-contract attachment to a later session.

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewSubcontractPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  const subcontractors = await db
    .select({
      id: schema.subcontractors.id,
      name: schema.subcontractors.name,
    })
    .from(schema.subcontractors)
    .where(eq(schema.subcontractors.tenantId, tenant.id))
    .orderBy(asc(schema.subcontractors.name));

  // If the directory is empty, the form has nothing to bind to — guide the
  // user back to /subcontractors first instead of letting them fail at submit.
  if (subcontractors.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add subcontract</h1>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">No subcontractors in your directory yet.</p>
          <p className="mt-1 text-amber-800">
            Add at least one subcontractor before drafting a subcontract — the
            subcontract has to point at someone.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/subcontractors/new"
              className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              + Add subcontractor
            </Link>
            <Link
              href={`/projects/${projectId}/subs`}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add subcontract</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick a subcontractor and enter the contract terms. Spec sections,
          inclusions/exclusions, and signed PDFs can be attached later.
        </p>
      </div>

      <form action={createSubcontract} className="space-y-5">
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <label htmlFor="subcontractorId" className="block text-sm font-medium text-slate-700">
            Subcontractor
          </label>
          <select
            id="subcontractorId"
            name="subcontractorId"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Pick a subcontractor…
            </option>
            {subcontractors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Don&rsquo;t see them?{' '}
            <Link
              href="/subcontractors/new"
              className="text-blue-700 hover:underline"
            >
              Add a new subcontractor
            </Link>
            .
          </p>
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
            placeholder="e.g. 215-002"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="originalAmount" className="block text-sm font-medium text-slate-700">
            Original amount
          </label>
          <input
            id="originalAmount"
            name="originalAmount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            Contract value before any change orders.
          </p>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue="draft"
            className={inputClass}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
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
            Add subcontract
          </button>
        </div>
      </form>
    </div>
  );
}
