import Link from 'next/link';
import { db, schema } from '@constructor/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';

// Projects list. Server Component — fetches tenant-scoped projects and renders.
// See gc-wireframes-brief.md § Screen 2 (this is the "Recent projects" slice
// of the eventual Dashboard; full dashboard with stat cards lands later).
//
// Soft delete: rows with deleted_at set are hidden by default. Pass
// ?showArchived=true to include them; archived rows render with a muted
// visual treatment and a Restore button.

type PageProps = {
  searchParams: Promise<{ showArchived?: string }>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const { showArchived } = await searchParams;
  const includeArchived = showArchived === 'true';
  const tenant = await getCurrentTenant();

  const projects = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.tenantId, tenant.id),
        includeArchived ? undefined : isNull(schema.projects.deletedAt),
      ),
    )
    .orderBy(desc(schema.projects.createdAt));

  const archivedCount = includeArchived
    ? projects.filter((p) => p.deletedAt !== null).length
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          {includeArchived && (
            <p className="mt-1 text-xs text-slate-500">
              Including {archivedCount} archived.{' '}
              <Link href="/projects" className="text-blue-700 hover:underline">
                Hide archived
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!includeArchived && (
            <Link
              href="/projects?showArchived=true"
              className="text-xs text-slate-600 transition hover:text-slate-900"
            >
              Show archived
            </Link>
          )}
          <Link
            href="/projects/new"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            + New project
          </Link>
        </div>
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
              {projects.map((p) => {
                const isArchived = p.deletedAt !== null;
                return (
                  <tr
                    key={p.id}
                    className={
                      'hover:bg-slate-50 ' + (isArchived ? 'opacity-60' : '')
                    }
                  >
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
                      {isArchived && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          Archived
                        </span>
                      )}
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
                );
              })}
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
