import Link from 'next/link';
import { db, schema } from '@constructor/db';
import { desc, eq } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';

// Projects list. Server Component — fetches tenant-scoped projects and renders.
// See gc-wireframes-brief.md § Screen 2 (this is the "Recent projects" slice
// of the eventual Dashboard; full dashboard with stat cards lands later).

export default async function ProjectsPage() {
  const tenant = await getCurrentTenant();
  const projects = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.tenantId, tenant.id))
    .orderBy(desc(schema.projects.createdAt));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          + New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-600">No projects yet.</p>
          <Link
            href="/projects/new"
            className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  #
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Original $
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                    {p.projectNumber}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums">
                    ${formatMoney(p.originalContractAmount)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {p.status}
                    </span>
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

function formatMoney(value: string) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
