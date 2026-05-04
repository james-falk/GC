import Link from 'next/link';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Cross-project document vault. Tenant-scoped flat list of every
// attachment across every active project, regardless of which entity it
// hangs off (project / change_order / pay_application / sworn_statement).
//
// Uploads still happen at the per-project level (Documents tab) — this
// page is read-only. Click any project name to jump into that project's
// vault and upload more.

type DocRow = {
  id: string;
  entityType: string;
  filename: string;
  storageKey: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedByEmail: string | null;
  projectId: string;
  projectName: string;
  projectNumber: string;
};

const TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  pay_application: 'Pay app',
  change_order: 'CO',
  sworn_statement: 'Sworn statement',
  subcontract: 'Subcontract',
};

const TYPE_STYLES: Record<string, string> = {
  project: 'bg-slate-100 text-slate-700',
  pay_application: 'bg-emerald-100 text-emerald-800',
  change_order: 'bg-blue-100 text-blue-800',
  sworn_statement: 'bg-amber-100 text-amber-800',
  subcontract: 'bg-violet-100 text-violet-800',
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'project', label: 'Project' },
  { value: 'change_order', label: 'CO' },
  { value: 'pay_application', label: 'Pay app' },
  { value: 'sworn_statement', label: 'Sworn statement' },
];

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function GlobalDocumentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter = sp.filter ?? 'all';
  const tenant = await getCurrentTenant();

  // Polymorphic entity_type means we resolve the owning project via a
  // different join per type. Query each branch separately and union in JS.
  // Cheap on small data; if this ever bottlenecks, push to a SQL UNION.
  const [projectDocs, coDocs, payAppDocs, swornDocs] = await Promise.all([
    db
      .select({
        id: schema.documentAttachments.id,
        entityType: schema.documentAttachments.entityType,
        filename: schema.documentAttachments.filename,
        storageKey: schema.documentAttachments.storageKey,
        sizeBytes: schema.documentAttachments.sizeBytes,
        createdAt: schema.documentAttachments.createdAt,
        uploadedByEmail: schema.users.email,
        projectId: schema.projects.id,
        projectName: schema.projects.name,
        projectNumber: schema.projects.projectNumber,
      })
      .from(schema.documentAttachments)
      .innerJoin(
        schema.projects,
        and(
          eq(schema.documentAttachments.entityId, schema.projects.id),
          isNull(schema.projects.deletedAt),
        ),
      )
      .leftJoin(
        schema.users,
        eq(schema.documentAttachments.uploadedByUserId, schema.users.id),
      )
      .where(
        and(
          eq(schema.documentAttachments.tenantId, tenant.id),
          eq(schema.documentAttachments.entityType, 'project'),
        ),
      ),
    db
      .select({
        id: schema.documentAttachments.id,
        entityType: schema.documentAttachments.entityType,
        filename: schema.documentAttachments.filename,
        storageKey: schema.documentAttachments.storageKey,
        sizeBytes: schema.documentAttachments.sizeBytes,
        createdAt: schema.documentAttachments.createdAt,
        uploadedByEmail: schema.users.email,
        projectId: schema.projects.id,
        projectName: schema.projects.name,
        projectNumber: schema.projects.projectNumber,
      })
      .from(schema.documentAttachments)
      .innerJoin(
        schema.changeOrders,
        eq(schema.documentAttachments.entityId, schema.changeOrders.id),
      )
      .innerJoin(
        schema.projects,
        and(
          eq(schema.changeOrders.projectId, schema.projects.id),
          isNull(schema.projects.deletedAt),
        ),
      )
      .leftJoin(
        schema.users,
        eq(schema.documentAttachments.uploadedByUserId, schema.users.id),
      )
      .where(
        and(
          eq(schema.documentAttachments.tenantId, tenant.id),
          eq(schema.documentAttachments.entityType, 'change_order'),
        ),
      ),
    db
      .select({
        id: schema.documentAttachments.id,
        entityType: schema.documentAttachments.entityType,
        filename: schema.documentAttachments.filename,
        storageKey: schema.documentAttachments.storageKey,
        sizeBytes: schema.documentAttachments.sizeBytes,
        createdAt: schema.documentAttachments.createdAt,
        uploadedByEmail: schema.users.email,
        projectId: schema.projects.id,
        projectName: schema.projects.name,
        projectNumber: schema.projects.projectNumber,
      })
      .from(schema.documentAttachments)
      .innerJoin(
        schema.payApplications,
        eq(schema.documentAttachments.entityId, schema.payApplications.id),
      )
      .innerJoin(
        schema.projects,
        and(
          eq(schema.payApplications.projectId, schema.projects.id),
          isNull(schema.projects.deletedAt),
        ),
      )
      .leftJoin(
        schema.users,
        eq(schema.documentAttachments.uploadedByUserId, schema.users.id),
      )
      .where(
        and(
          eq(schema.documentAttachments.tenantId, tenant.id),
          eq(schema.documentAttachments.entityType, 'pay_application'),
        ),
      ),
    db
      .select({
        id: schema.documentAttachments.id,
        entityType: schema.documentAttachments.entityType,
        filename: schema.documentAttachments.filename,
        storageKey: schema.documentAttachments.storageKey,
        sizeBytes: schema.documentAttachments.sizeBytes,
        createdAt: schema.documentAttachments.createdAt,
        uploadedByEmail: schema.users.email,
        projectId: schema.projects.id,
        projectName: schema.projects.name,
        projectNumber: schema.projects.projectNumber,
      })
      .from(schema.documentAttachments)
      .innerJoin(
        schema.swornStatements,
        eq(schema.documentAttachments.entityId, schema.swornStatements.id),
      )
      .innerJoin(
        schema.payApplications,
        eq(schema.swornStatements.payApplicationId, schema.payApplications.id),
      )
      .innerJoin(
        schema.projects,
        and(
          eq(schema.payApplications.projectId, schema.projects.id),
          isNull(schema.projects.deletedAt),
        ),
      )
      .leftJoin(
        schema.users,
        eq(schema.documentAttachments.uploadedByUserId, schema.users.id),
      )
      .where(
        and(
          eq(schema.documentAttachments.tenantId, tenant.id),
          eq(schema.documentAttachments.entityType, 'sworn_statement'),
        ),
      ),
  ]);

  const all: DocRow[] = [...projectDocs, ...coDocs, ...payAppDocs, ...swornDocs];
  all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const filtered =
    filter === 'all' ? all : all.filter((d) => d.entityType === filter);

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f.value,
      f.value === 'all' ? all.length : all.filter((d) => d.entityType === f.value).length,
    ]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every file across every active project. Uploads happen at the
          project level — click into a project name to add more.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'all' ? '/documents' : `/documents?filter=${f.value}`}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                (active
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              {f.label}
              <span className="ml-1.5 tabular-nums text-[10px] text-slate-500">
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">
            {all.length === 0
              ? 'No documents in this tenant yet.'
              : `No documents match the "${filter}" filter.`}
          </p>
          {all.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Open a project's Documents tab to upload your first file.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Project
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Filename
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Size
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Uploaded by
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    <Link
                      href={`/projects/${d.projectId}/documents`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {d.projectName}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      #{d.projectNumber}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (TYPE_STYLES[d.entityType] ?? 'bg-slate-100 text-slate-700')
                      }
                    >
                      {TYPE_LABELS[d.entityType] ?? d.entityType}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
                    {d.filename}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums text-slate-600">
                    {formatSize(d.sizeBytes)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {d.uploadedByEmail ?? '—'}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
                    {new Date(d.createdAt).toLocaleDateString()}
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
