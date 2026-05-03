import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Subcontractor directory — tenant-scoped list of all subs the GC has worked
// with. Reusable across projects: when you draft a subcontract on a specific
// project, you pick from this directory. See gc-data-model.md § Subcontractor.

export default async function SubcontractorsPage() {
  const tenant = await getCurrentTenant();
  const rows = await db
    .select()
    .from(schema.subcontractors)
    .where(eq(schema.subcontractors.tenantId, tenant.id))
    .orderBy(asc(schema.subcontractors.name));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subcontractors</h1>
          <p className="mt-1 text-sm text-slate-600">
            Directory of subs you&rsquo;ve worked with. Each entry is reusable —
            when you draft a subcontract on a project, you pick from this list.
          </p>
        </div>
        <Link
          href="/subcontractors/new"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          + Add subcontractor
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">No subcontractors yet.</p>
          <Link
            href="/subcontractors/new"
            className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Add your first subcontractor
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Address
                </th>
                <th className="border-b border-slate-200 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">
                    {s.name}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {s.contactEmail ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {s.contactPhone ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {s.address ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-xs">
                    <Link
                      href={`/subcontractors/${s.id}/edit`}
                      className="font-medium text-blue-700 transition hover:text-blue-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
