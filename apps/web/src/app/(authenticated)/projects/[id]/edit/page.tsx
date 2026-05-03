import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { updateProject } from '../../actions';

// Edit project — name, number, total, status, owner, architect.
// Archived projects are read-only (404 here; restore from layout banner).

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'closed', label: 'Closed' },
] as const;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await getCurrentTenant();

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.tenantId, tenant.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .limit(1);
  if (!project) notFound();

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
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Edit project</h2>
          <p className="text-sm text-slate-600">
            Adjust project metadata. SoV lines, subcontracts, and pay-app history
            are unaffected.
          </p>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      <form action={updateProject} className="max-w-xl space-y-5">
        <input type="hidden" name="projectId" value={project.id} />

        <div>
          <label htmlFor="projectNumber" className="block text-sm font-medium text-slate-700">
            Project number
          </label>
          <input
            id="projectNumber"
            name="projectNumber"
            required
            maxLength={64}
            defaultValue={project.projectNumber}
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
            defaultValue={project.name}
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
            defaultValue={project.originalContractAmount}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            The original signed-contract value. Approved COs adjust the current
            value separately on subcontract and SoV-line records — this field
            stays at the as-bid baseline.
          </p>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={project.status}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ownerId" className="block text-sm font-medium text-slate-700">
            Owner
          </label>
          <select
            id="ownerId"
            name="ownerId"
            defaultValue={project.ownerId ?? ''}
            className={inputClass}
          >
            <option value="">No owner attached</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {owners.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No owner organizations in your directory yet.{' '}
              <Link href="/organizations/new" className="text-blue-700 hover:underline">
                Add one
              </Link>
              .
            </p>
          )}
        </div>

        <div>
          <label htmlFor="architectId" className="block text-sm font-medium text-slate-700">
            Architect
          </label>
          <select
            id="architectId"
            name="architectId"
            defaultValue={project.architectId ?? ''}
            className={inputClass}
          >
            <option value="">No architect attached</option>
            {architects.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {architects.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No architect organizations in your directory yet.{' '}
              <Link href="/organizations/new" className="text-blue-700 hover:underline">
                Add one
              </Link>
              .
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href={`/projects/${project.id}`}
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
