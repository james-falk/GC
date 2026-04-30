import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Project detail. See gc-wireframes-brief.md § Screen 3.
// Header is real; tab content is a placeholder until the SoV editor lands.

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
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
        <nav className="-mb-px flex gap-6">
          <span className="border-b-2 border-blue-700 pb-2 text-sm font-medium text-blue-700">
            SoV
          </span>
          <span className="pb-2 text-sm text-slate-400">Subs</span>
          <span className="pb-2 text-sm text-slate-400">Pay Apps</span>
          <span className="pb-2 text-sm text-slate-400">Change Orders</span>
          <span className="pb-2 text-sm text-slate-400">Documents</span>
        </nav>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm text-slate-600">SoV editor lands next session.</p>
      </div>
    </div>
  );
}

function formatMoney(value: string) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
