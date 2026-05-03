import Link from 'next/link';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { resolveBaseUrl } from '@/lib/magic-link';
import { startMonthlyPayApp } from './actions';

// Pay Apps tab — real list scoped to this project. See
// gc-wireframes-brief.md § Screen 7 (review) and § Screen 9 (owner pay app).
//
// Two flows from this page:
//   1. PM clicks 'Start monthly pay app' → for each active subcontract,
//      creates a sub_to_gc pay_application + a magic_link the sub clicks
//      to fill in their numbers.
//   2. Submitted sub pay-apps appear with status badges; clicking into one
//      goes to the GC review screen (Round 2b).

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  needs_revision: 'bg-orange-100 text-orange-800',
  approved_by_pm: 'bg-emerald-100 text-emerald-800',
  approved_by_principal: 'bg-emerald-100 text-emerald-800',
  approved: 'bg-emerald-100 text-emerald-800',
  included_in_owner_pay_app: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-200 text-emerald-900',
  cancelled: 'bg-slate-200 text-slate-700',
  generated: 'bg-blue-100 text-blue-800',
  signed: 'bg-blue-100 text-blue-800',
  notarized: 'bg-blue-100 text-blue-800',
  sent_to_architect: 'bg-amber-100 text-amber-800',
  architect_approved: 'bg-emerald-100 text-emerald-800',
  sent_to_owner: 'bg-amber-100 text-amber-800',
  owner_approved: 'bg-emerald-100 text-emerald-800',
};

const inputClass =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    startedPeriod?: string;
    tokens?: string;
    skipped?: string;
  }>;
};

export default async function ProjectPayAppsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: projectId } = await params;
  const sp = await searchParams;
  const tenant = await getCurrentTenant();

  // All pay apps for this project, joined to subcontract + subcontractor
  // (for sub_to_gc) so we can show 'who'.
  const payApps = await db
    .select({
      id: schema.payApplications.id,
      direction: schema.payApplications.direction,
      status: schema.payApplications.status,
      periodStart: schema.payApplications.periodStart,
      periodEnd: schema.payApplications.periodEnd,
      submittedAt: schema.payApplications.submittedAt,
      totalBilled: schema.payApplications.totalBilled,
      subcontractId: schema.payApplications.subcontractId,
      subcontractorName: schema.subcontractors.name,
      contractNumber: schema.subcontracts.contractNumber,
    })
    .from(schema.payApplications)
    .leftJoin(
      schema.subcontracts,
      eq(schema.payApplications.subcontractId, schema.subcontracts.id),
    )
    .leftJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.payApplications.projectId, projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    )
    .orderBy(
      desc(schema.payApplications.periodStart),
      asc(schema.subcontracts.contractNumber),
    );

  // Decode the just-generated magic-link banner if present.
  const baseUrl = resolveBaseUrl();
  const generatedLinks =
    sp.tokens && sp.startedPeriod
      ? sp.tokens.split(',').map((entry) => {
          const [name, token] = entry.split('|');
          return { name: decodeURIComponent(name ?? ''), token: token ?? '' };
        })
      : [];
  const skippedSubs = sp.skipped ? sp.skipped.split(',') : [];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pay Apps</h2>
          <p className="text-sm text-slate-600">
            Monthly cycle: PM starts a period, each sub gets a magic-link to
            fill in their numbers, PM reviews + approves, then the assembled
            owner pay app rolls up.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${projectId}/pay-apps/sworn-statement`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sworn statement →
          </Link>
          <Link
            href={`/projects/${projectId}/pay-apps/aia`}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            AIA pay app →
          </Link>
        </div>
      </div>

      {/* Just-generated magic-link banner — only chance to copy URLs */}
      {generatedLinks.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-medium">
            Started pay-app cycle for {sp.startedPeriod}.
          </div>
          <div className="mt-1 text-xs text-emerald-800">
            {generatedLinks.length} sub pay-app{generatedLinks.length === 1 ? '' : 's'}{' '}
            generated. Send these URLs to the corresponding subs (single-use,
            valid 72h). Email delivery (Resend) lands in Round 4 — for now copy
            them by hand.
          </div>
          <ul className="mt-3 space-y-2">
            {generatedLinks.map((g) => (
              <li key={g.token} className="text-xs">
                <div className="font-medium text-emerald-900">{g.name}</div>
                <div className="mt-0.5 break-all rounded border border-emerald-200 bg-white px-2 py-1 font-mono text-slate-800">
                  {baseUrl}/sub-pay-app/{g.token}
                </div>
              </li>
            ))}
          </ul>
          {skippedSubs.length > 0 && (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              <strong>Skipped (no contact email):</strong>{' '}
              {skippedSubs.join(', ')}. Add an email under{' '}
              <Link href="/subcontractors" className="text-amber-700 hover:underline">
                Subcontractors
              </Link>{' '}
              and re-run.
            </div>
          )}
          <div className="mt-3">
            <Link
              href={`/projects/${projectId}/pay-apps`}
              className="text-[11px] text-emerald-700 hover:underline"
            >
              Dismiss
            </Link>
          </div>
        </div>
      )}

      {/* Start a new monthly cycle */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Start monthly pay-app cycle
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Creates a sub pay-app + magic-link for every active subcontract on
          this project for the period below.
        </p>
        <form
          action={startMonthlyPayApp}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <div className="sm:col-span-4">
            <label htmlFor="periodStart" className="block text-xs font-medium text-slate-700">
              Period start
            </label>
            <input
              id="periodStart"
              name="periodStart"
              type="date"
              required
              className={inputClass + ' mt-1'}
            />
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="periodEnd" className="block text-xs font-medium text-slate-700">
              Period end
            </label>
            <input
              id="periodEnd"
              name="periodEnd"
              type="date"
              required
              className={inputClass + ' mt-1'}
            />
          </div>
          <div className="flex items-end sm:col-span-4">
            <button
              type="submit"
              className="w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Start cycle
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {payApps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">No pay apps yet on this project.</p>
          <p className="mt-1 text-xs text-slate-500">
            Use the form above to start a monthly cycle.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Direction
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  From / To
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Period
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total $
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {payApps.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-xs uppercase tracking-wide text-slate-600">
                    {p.direction === 'sub_to_gc' ? 'Sub → GC' : 'GC → Owner'}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    {p.direction === 'sub_to_gc' ? (
                      <Link
                        href={`/projects/${projectId}/pay-apps/${p.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {p.subcontractorName ?? 'Unknown sub'}
                        {p.contractNumber && (
                          <span className="ml-2 text-xs text-slate-500">
                            {p.contractNumber}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <Link
                        href={`/projects/${projectId}/pay-apps/aia?payAppId=${p.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        Owner pay app
                      </Link>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {formatPeriod(p.periodStart, p.periodEnd)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums">
                    ${formatMoney(p.totalBilled)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-700')
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                    {p.submittedAt
                      ? new Date(p.submittedAt).toLocaleDateString()
                      : <span className="text-slate-400">—</span>}
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

function formatPeriod(start: string, end: string): string {
  // Display as "Mar 2026" if start month === end month, else "Mar 1 – Apr 5, 2026".
  const s = new Date(start);
  const e = new Date(end);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return s.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}
