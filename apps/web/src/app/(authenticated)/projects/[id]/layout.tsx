import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ProjectTabs } from './_components/project-tabs';
import { archiveProject, restoreProject } from '../actions';

// Project detail layout — wraps every tab (SoV, Subs, Pay Apps, COs, Documents)
// with a shared header (project metadata) and tab nav. See
// gc-wireframes-brief.md § Screen 3.
//
// Soft delete: archived projects (deleted_at IS NOT NULL) still resolve so
// they can be inspected and restored, but render with an Archived banner
// and a Restore action instead of Archive.

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const tenant = await getCurrentTenant();

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.tenantId, tenant.id)))
    .limit(1);

  if (!project) notFound();

  // Resolve linked organizations for header display. Each is optional; we
  // batch the two lookups in parallel and fall back to '—' if missing.
  const orgIds = [project.ownerId, project.architectId].filter(
    (i): i is string => Boolean(i),
  );
  const orgs =
    orgIds.length > 0
      ? await db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.tenantId, tenant.id))
      : [];
  const orgsById = new Map(orgs.map((o) => [o.id, o.name]));
  const ownerName = project.ownerId ? orgsById.get(project.ownerId) : null;
  const architectName = project.architectId
    ? orgsById.get(project.architectId)
    : null;

  const isArchived = project.deletedAt !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {isArchived && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-medium">Archived</span> on{' '}
              {project.deletedAt
                ? new Date(project.deletedAt).toLocaleDateString()
                : ''}
              . Read-only — restore to make changes.
            </div>
            <form action={restoreProject}>
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
              >
                Restore project
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="border-b border-slate-200 pb-5">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Project #{project.projectNumber}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {project.status}
            </span>
          </div>
          {!isArchived && (
            <form action={archiveProject}>
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                title="Soft-delete: project is hidden from the list but recoverable"
              >
                Archive
              </button>
            </form>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Original</dt>
            <dd className="tabular-nums">${formatMoney(project.originalContractAmount)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Owner</dt>
            <dd className={ownerName ? '' : 'text-slate-400'}>{ownerName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Architect</dt>
            <dd className={architectName ? '' : 'text-slate-400'}>{architectName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>{project.status}</dd>
          </div>
        </dl>
      </header>

      <div className="border-b border-slate-200">
        <ProjectTabs projectId={project.id} />
      </div>

      {children}
    </div>
  );
}

function formatMoney(value: string) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
