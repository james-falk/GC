import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { DocumentsUploader } from './_components/uploader';
import { DownloadButton } from './_components/download-button';

// Documents tab — Document Vault. Real query against document_attachments
// scoped to this project. Direct-to-R2 upload pipeline via presigned URLs.
//
// We surface attachments tied directly to entity_type='project'
// PLUS attachments belonging to entities owned by this project (sworn
// statements, change orders, pay applications). The schema is polymorphic;
// we union those into a single list ordered by upload time.

type PageProps = {
  params: Promise<{ id: string }>;
};

const TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  pay_application: 'Pay app',
  change_order: 'CO',
  sworn_statement: 'Sworn statement',
  subcontract: 'Subcontract',
  subcontractor: 'Subcontractor',
  sov_line: 'SoV line',
};

const TYPE_STYLES: Record<string, string> = {
  project: 'bg-slate-100 text-slate-700',
  pay_application: 'bg-emerald-100 text-emerald-800',
  change_order: 'bg-blue-100 text-blue-800',
  sworn_statement: 'bg-amber-100 text-amber-800',
  subcontract: 'bg-violet-100 text-violet-800',
  subcontractor: 'bg-violet-100 text-violet-800',
  sov_line: 'bg-slate-100 text-slate-700',
};

export default async function ProjectDocumentsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  // Two queries to keep tenant scoping clean:
  //   1. attachments directly on this project
  //   2. attachments on child entities (CO / pay app / sworn statement)
  //      that belong to this project. We resolve the ids first then filter.
  const childCoIds = await db
    .select({ id: schema.changeOrders.id })
    .from(schema.changeOrders)
    .where(
      and(
        eq(schema.changeOrders.projectId, projectId),
        eq(schema.changeOrders.tenantId, tenant.id),
      ),
    );
  const childPayAppIds = await db
    .select({ id: schema.payApplications.id })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    );
  const childSwornStatementIds = await db
    .select({ id: schema.swornStatements.id })
    .from(schema.swornStatements)
    .innerJoin(
      schema.payApplications,
      eq(schema.swornStatements.payApplicationId, schema.payApplications.id),
    )
    .where(
      and(
        eq(schema.payApplications.projectId, projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    );

  const conditions = [
    and(
      eq(schema.documentAttachments.entityType, 'project'),
      eq(schema.documentAttachments.entityId, projectId),
    ),
  ];
  if (childCoIds.length > 0) {
    conditions.push(
      and(
        eq(schema.documentAttachments.entityType, 'change_order'),
        inArray(
          schema.documentAttachments.entityId,
          childCoIds.map((c) => c.id),
        ),
      ),
    );
  }
  if (childPayAppIds.length > 0) {
    conditions.push(
      and(
        eq(schema.documentAttachments.entityType, 'pay_application'),
        inArray(
          schema.documentAttachments.entityId,
          childPayAppIds.map((c) => c.id),
        ),
      ),
    );
  }
  if (childSwornStatementIds.length > 0) {
    conditions.push(
      and(
        eq(schema.documentAttachments.entityType, 'sworn_statement'),
        inArray(
          schema.documentAttachments.entityId,
          childSwornStatementIds.map((c) => c.id),
        ),
      ),
    );
  }

  const docs = await db
    .select({
      id: schema.documentAttachments.id,
      entityType: schema.documentAttachments.entityType,
      entityId: schema.documentAttachments.entityId,
      filename: schema.documentAttachments.filename,
      storageKey: schema.documentAttachments.storageKey,
      mimeType: schema.documentAttachments.mimeType,
      sizeBytes: schema.documentAttachments.sizeBytes,
      createdAt: schema.documentAttachments.createdAt,
      uploadedByEmail: schema.users.email,
    })
    .from(schema.documentAttachments)
    .leftJoin(
      schema.users,
      eq(schema.documentAttachments.uploadedByUserId, schema.users.id),
    )
    .where(
      and(
        eq(schema.documentAttachments.tenantId, tenant.id),
        or(...conditions),
      ),
    )
    .orderBy(desc(schema.documentAttachments.createdAt));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-slate-600">
            All files attached to this project. Anything signed, notarized, or
            sent to an external party lives here as the system of record.
          </p>
        </div>
        <DocumentsUploader projectId={projectId} />
      </div>

      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">
          PDF, JPG, PNG up to 25 MB.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Files upload directly to Cloudflare R2 — bytes don&rsquo;t pass through
          the app server.
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">No files attached yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Use the Upload button to add the first document.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
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
                <th className="border-b border-slate-200 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const syntheticHref = d.storageKey.startsWith('synthetic://')
                  ? syntheticToHref(d.storageKey, projectId)
                  : null;
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
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
                    <td className="border-b border-slate-100 px-4 py-3 text-right">
                      <DownloadButton
                        attachmentId={d.id}
                        syntheticHref={syntheticHref}
                      />
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Synthetic storage keys point at on-demand-rendered PDFs (sworn
// statements, AIA pay apps) instead of R2 bytes. Map them to the
// dedicated render route so download still works.
function syntheticToHref(storageKey: string, _projectId: string): string | null {
  // Format: synthetic://sworn-statement/<id>.pdf
  const m = /^synthetic:\/\/sworn-statement\/([0-9a-f-]+)\.pdf$/.exec(storageKey);
  if (m) return `/api/sworn-statement/${m[1]}`;
  return null;
}
