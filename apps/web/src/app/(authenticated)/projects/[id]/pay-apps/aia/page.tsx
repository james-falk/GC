import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// AIA Pay App Preview. See gc-wireframes-brief.md § Screen 9.
//
// Resolves the most recent gc_to_owner pay app for this project (or a
// specific one via ?payAppId=). Embeds the real PDF (G702 page +
// G703 continuation) generated from real data. Empty state guides the
// user back to the Pay Apps tab to assemble one.

const STATUS_FLOW = [
  { key: 'generated', label: 'Generated' },
  { key: 'signed', label: 'Signed by Principal' },
  { key: 'notarized', label: 'Notarized' },
  { key: 'sent_to_architect', label: 'Sent to architect' },
  { key: 'architect_approved', label: 'Architect approved' },
  { key: 'sent_to_owner', label: 'Sent to owner' },
  { key: 'owner_approved', label: 'Owner approved' },
  { key: 'paid', label: 'Paid' },
];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payAppId?: string }>;
};

export default async function AiaPreviewPage({ params, searchParams }: PageProps) {
  const { id: projectId } = await params;
  const { payAppId: requestedId } = await searchParams;
  const tenant = await getCurrentTenant();

  // Pick the requested pay-app, else the most recent gc_to_owner for this project.
  const payApp = requestedId
    ? (
        await db
          .select()
          .from(schema.payApplications)
          .where(
            and(
              eq(schema.payApplications.id, requestedId),
              eq(schema.payApplications.projectId, projectId),
              eq(schema.payApplications.tenantId, tenant.id),
              eq(schema.payApplications.direction, 'gc_to_owner'),
            ),
          )
          .limit(1)
      )[0] ?? null
    : (
        await db
          .select()
          .from(schema.payApplications)
          .where(
            and(
              eq(schema.payApplications.projectId, projectId),
              eq(schema.payApplications.tenantId, tenant.id),
              eq(schema.payApplications.direction, 'gc_to_owner'),
            ),
          )
          .orderBy(desc(schema.payApplications.createdAt))
          .limit(1)
      )[0] ?? null;

  if (!payApp) {
    return (
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">AIA Pay App</h2>
          <Link
            href={`/projects/${projectId}/pay-apps`}
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            ← Back
          </Link>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">No owner pay app on this project yet.</p>
          <p className="mt-1 text-amber-800">
            Approve at least one sub pay-app for a period, then click{' '}
            <em>Assemble owner pay app</em> on the Pay Apps tab to generate
            the AIA G702/G703 PDFs.
          </p>
          <Link
            href={`/projects/${projectId}/pay-apps`}
            className="mt-4 inline-block rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Go to Pay Apps
          </Link>
        </div>
      </div>
    );
  }

  const pdfUrl = `/api/aia-pay-app/${payApp.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            AIA Pay App — {formatPeriod(payApp.periodStart, payApp.periodEnd)}
          </h2>
          <p className="text-sm text-slate-600">
            G702 cover sheet + G703 continuation sheet, generated from the
            real owner pay-app + line breakdown.
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
                G702 + G703 (combined)
              </span>
              <a
                href={pdfUrl}
                download
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-800"
              >
                Download PDF
              </a>
            </div>
            <iframe src={pdfUrl} title="AIA Pay App" className="h-[80vh] w-full" />
          </div>
        </div>

        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Metadata
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row
                label="Period"
                value={formatPeriod(payApp.periodStart, payApp.periodEnd)}
              />
              <Row
                label="Generated"
                value={new Date(payApp.createdAt).toLocaleDateString()}
              />
              <Row label="Status" value={payApp.status} />
              <Row
                label="Total billed"
                value={`$${formatMoney(payApp.totalBilled)}`}
              />
              <Row
                label="Retention"
                value={`$${formatMoney(payApp.totalRetention)}`}
              />
              <Row
                label="Net to invoice"
                value={`$${formatMoney(
                  String(
                    Number(payApp.totalBilled) - Number(payApp.totalRetention),
                  ),
                )}`}
                emphasis
              />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Status flow
            </h3>
            <ol className="mt-3 space-y-2.5">
              {STATUS_FLOW.map((s) => {
                const done = isAtOrPast(payApp.status, s.key);
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
              <button
                type="button"
                disabled
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-400"
              >
                Upload signed PDF
              </button>
              <button
                type="button"
                disabled
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-400"
              >
                Mark notarized
              </button>
              <button
                type="button"
                disabled
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-400"
              >
                Send to architect (magic-link)
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-400">
              State-advancement actions wire in Round 4 alongside the full
              CO chain. PDF generation works end-to-end now — Download PDF
              streams the real document.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={
          'tabular-nums text-right ' +
          (emphasis ? 'text-base font-semibold text-blue-700' : 'text-slate-900')
        }
      >
        {value}
      </dd>
    </div>
  );
}

const STATUS_ORDER = [
  'generated',
  'signed',
  'notarized',
  'sent_to_architect',
  'architect_approved',
  'sent_to_owner',
  'owner_approved',
  'paid',
];

function isAtOrPast(currentStatus: string, key: string): boolean {
  const cur = STATUS_ORDER.indexOf(currentStatus);
  const target = STATUS_ORDER.indexOf(key);
  if (cur === -1 || target === -1) return false;
  return cur >= target;
}

function formatMoney(value: string) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return s.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}
