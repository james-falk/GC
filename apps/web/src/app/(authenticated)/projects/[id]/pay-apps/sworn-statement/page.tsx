import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import {
  generateSwornStatementAction,
  markNotarizedAction,
  uploadSignedSwornStatementAction,
} from './actions';

// Sworn Statement Preview. See gc-wireframes-brief.md § Screen 10.
// Resolves the most recent sworn_statement on this project (or generates
// from the most recent owner pay-app if none exists yet).

const STATUS_FLOW = [
  { key: 'generated', label: 'Generated' },
  { key: 'signed', label: 'Signed by Principal' },
  { key: 'notarized', label: 'Notarized' },
  { key: 'sent_to_architect', label: 'Sent to architect' },
  { key: 'architect_approved', label: 'Architect approved' },
  { key: 'sent_to_owner', label: 'Sent to owner' },
  { key: 'owner_approved', label: 'Owner approved' },
  { key: 'archived', label: 'Project closed (archived)' },
];

const STATUS_ORDER = STATUS_FLOW.map((s) => s.key);

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SwornStatementPreviewPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  // Resolve the latest sworn statement for this project (joined to pay
  // app + project for tenant scoping).
  const [latestSs] = await db
    .select({
      id: schema.swornStatements.id,
      status: schema.swornStatements.status,
      payApplicationId: schema.swornStatements.payApplicationId,
      createdAt: schema.swornStatements.createdAt,
      payAppPeriodEnd: schema.payApplications.periodEnd,
    })
    .from(schema.swornStatements)
    .innerJoin(
      schema.payApplications,
      eq(schema.swornStatements.payApplicationId, schema.payApplications.id),
    )
    .where(
      and(
        eq(schema.swornStatements.tenantId, tenant.id),
        eq(schema.payApplications.projectId, projectId),
      ),
    )
    .orderBy(desc(schema.swornStatements.createdAt))
    .limit(1);

  // Most recent owner pay-app (in case we need to generate).
  const [latestOwnerPayApp] = await db
    .select({
      id: schema.payApplications.id,
      periodEnd: schema.payApplications.periodEnd,
    })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, projectId),
        eq(schema.payApplications.tenantId, tenant.id),
        eq(schema.payApplications.direction, 'gc_to_owner'),
      ),
    )
    .orderBy(desc(schema.payApplications.createdAt))
    .limit(1);

  if (!latestSs) {
    return (
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Sworn Statement</h2>
          <Link
            href={`/projects/${projectId}/pay-apps`}
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            ← Back
          </Link>
        </div>
        {latestOwnerPayApp ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
            <p className="font-medium">No sworn statement on this project yet.</p>
            <p className="mt-1 text-blue-800">
              Generate one from the most recent owner pay-app for{' '}
              {latestOwnerPayApp.periodEnd}.
            </p>
            <form action={generateSwornStatementAction} className="mt-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="hidden"
                name="ownerPayAppId"
                value={latestOwnerPayApp.id}
              />
              <button
                type="submit"
                className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
              >
                Generate sworn statement
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-medium">No owner pay app on this project yet.</p>
            <p className="mt-1 text-amber-800">
              Assemble an owner pay app first, then come back to generate the
              sworn statement.
            </p>
            <Link
              href={`/projects/${projectId}/pay-apps`}
              className="mt-4 inline-block rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Go to Pay Apps
            </Link>
          </div>
        )}
      </div>
    );
  }

  const pdfUrl = `/api/sworn-statement/${latestSs.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Sworn Statement — period ending {latestSs.payAppPeriodEnd}
          </h2>
          <p className="text-sm text-slate-600">
            Affidavit of payment to subcontractors. Routed alongside the AIA
            pay app — shares the same magic-links and advances in lockstep.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/pay-apps`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs">
              <span className="font-medium text-slate-700">
                Contractor's Sworn Statement
              </span>
              <a
                href={pdfUrl}
                download
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-800"
              >
                Download PDF
              </a>
            </div>
            <iframe src={pdfUrl} title="Sworn Statement" className="h-[80vh] w-full" />
          </div>
        </div>

        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Status flow
            </h3>
            <ol className="mt-3 space-y-2.5">
              {STATUS_FLOW.map((s) => {
                const done = isAtOrPast(latestSs.status, s.key);
                return (
                  <li key={s.key} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={
                        'h-2 w-2 shrink-0 rounded-full ' +
                        (done ? 'bg-blue-700' : 'bg-slate-300')
                      }
                    />
                    <span
                      className={
                        'text-xs ' +
                        (done ? 'font-medium text-slate-900' : 'text-slate-500')
                      }
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Actions
            </h3>
            <div className="mt-3 space-y-2">
              <form action={uploadSignedSwornStatementAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="swornStatementId" value={latestSs.id} />
                <button
                  type="submit"
                  disabled={latestSs.status !== 'generated'}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                  title="Mark signed (R2 upload pipeline lands in Round 4)"
                >
                  Mark signed
                </button>
              </form>
              <form action={markNotarizedAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="swornStatementId" value={latestSs.id} />
                <button
                  type="submit"
                  disabled={latestSs.status !== 'signed'}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Mark notarized
                </button>
              </form>
              <button
                type="button"
                disabled
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-400"
              >
                Send to architect (magic-link)
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-400">
              Send-to-architect / send-to-owner magic-link flows wire in
              Round 4 alongside the full CO chain. Mark signed currently
              transitions state without storing a real PDF — R2 upload
              pipeline lands in Round 4.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function isAtOrPast(currentStatus: string, key: string): boolean {
  const cur = STATUS_ORDER.indexOf(currentStatus);
  const target = STATUS_ORDER.indexOf(key);
  if (cur === -1 || target === -1) return false;
  return cur >= target;
}
