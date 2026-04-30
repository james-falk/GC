import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ProjectTabs } from './_components/project-tabs';

// Project detail layout — wraps every tab (SoV, Subs, Pay Apps, COs, Documents)
// with a shared header (project metadata) and tab nav. Each tab is its own
// route segment so URLs are bookmarkable and the active tab is reflected in
// the URL bar. See gc-wireframes-brief.md § Screen 3.

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Project #{project.projectNumber}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {project.status}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Original</dt>
            <dd className="tabular-nums">${formatMoney(project.originalContractAmount)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Owner</dt>
            <dd className="text-slate-400">—</dd>
          </div>
          <div>
            <dt className="text-slate-500">Architect</dt>
            <dd className="text-slate-400">—</dd>
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
