import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { createProject } from './actions';

// Project create form. Owner + architect dropdowns read from the
// Organizations directory; both are optional (a project can be created
// without them and updated later) but encouraged.

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default async function NewProjectPage() {
  const tenant = await getCurrentTenant();

  const [owners, architects] = await Promise.all([
    db
      .select({ id: schema.organizations.id, name: schema.organizations.name })
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.tenantId, tenant.id),
          eq(schema.organizations.type, 'owner'),
        ),
      )
      .orderBy(asc(schema.organizations.name)),
    db
      .select({ id: schema.organizations.id, name: schema.organizations.name })
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.tenantId, tenant.id),
          eq(schema.organizations.type, 'architect'),
        ),
      )
      .orderBy(asc(schema.organizations.name)),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick an owner and architect from your directory, or skip and add
          them later.
        </p>
      </div>

      {(owners.length === 0 || architects.length === 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Heads up</p>
          <p className="mt-1 text-xs">
            {owners.length === 0 && architects.length === 0
              ? 'You have no organizations in your directory yet. The owner + architect dropdowns will be empty until you add some.'
              : owners.length === 0
                ? 'No owner organizations yet — the owner dropdown will be empty.'
                : 'No architect organizations yet — the architect dropdown will be empty.'}{' '}
            <Link href="/organizations/new" className="text-amber-700 hover:underline">
              Add organizations
            </Link>{' '}
            first if you want to attach them at create time.
          </p>
        </div>
      )}

      <form action={createProject} className="space-y-5">
        <div>
          <label htmlFor="projectNumber" className="block text-sm font-medium text-slate-700">
            Project number
          </label>
          <input
            id="projectNumber"
            name="projectNumber"
            required
            maxLength={64}
            placeholder="e.g. 215"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            placeholder="e.g. Lakeside Office Building"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="originalContractAmount"
            className="block text-sm font-medium text-slate-700"
          >
            Original contract amount
          </label>
          <input
            id="originalContractAmount"
            name="originalContractAmount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            Total contract value with the project owner, before any change orders.
          </p>
        </div>

        <div>
          <label htmlFor="ownerId" className="block text-sm font-medium text-slate-700">
            Owner (optional)
          </label>
          <select id="ownerId" name="ownerId" defaultValue="" className={inputClass}>
            <option value="">No owner attached yet</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="architectId" className="block text-sm font-medium text-slate-700">
            Architect (optional)
          </label>
          <select
            id="architectId"
            name="architectId"
            defaultValue=""
            className={inputClass}
          >
            <option value="">No architect attached yet</option>
            {architects.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/projects"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
