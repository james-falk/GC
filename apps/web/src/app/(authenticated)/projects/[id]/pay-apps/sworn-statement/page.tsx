import Link from 'next/link';

// Sworn Statement Preview. See gc-wireframes-brief.md § Screen 10.
// Same shape as the AIA preview (Screen 9), different document content.
// Status flow per state machine: Generated -> Signed -> Notarized ->
// SentToArchitect -> ArchitectApproved -> SentToOwner -> OwnerApproved
// -> ProjectClosed.

const STATUS_FLOW = [
  { key: 'generated', label: 'Generated', done: true },
  { key: 'signed', label: 'Signed by Principal', done: false },
  { key: 'notarized', label: 'Notarized', done: false },
  { key: 'sent_to_architect', label: 'Sent to architect', done: false },
  { key: 'architect_approved', label: 'Architect approved', done: false },
  { key: 'sent_to_owner', label: 'Sent to owner', done: false },
  { key: 'owner_approved', label: 'Owner approved', done: false },
  { key: 'archived', label: 'Project closed (archived)', done: false },
];

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SwornStatementPreviewPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const docId = 'mock-sworn-march-2026';
  const pdfUrl = `/api/sworn-statement/${docId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Sworn Statement — March 2026
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
            <iframe
              src={pdfUrl}
              title="Sworn Statement"
              className="h-[80vh] w-full"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Real format varies by state. The seed-shaped totals add up to
            $268,313.30 paid this period (Brothers & Bricks March pay app).
          </p>
        </div>

        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Metadata
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Period" value="March 1–31, 2026" />
              <Row label="Subs listed" value="8" />
              <Row label="Total contracts" value="$1,486,272.00" />
              <Row label="Paid prior" value="$0.00" />
              <Row label="Paid this period" value="$268,313.30" emphasis />
              <Row label="Balance owed" value="$1,217,958.70" />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Status flow
            </h3>
            <ol className="mt-3 space-y-2.5">
              {STATUS_FLOW.map((s) => (
                <li key={s.key} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={
                      'h-2 w-2 shrink-0 rounded-full ' +
                      (s.done ? 'bg-blue-700' : 'bg-slate-300')
                    }
                  />
                  <span
                    className={
                      'text-xs ' +
                      (s.done ? 'font-medium text-slate-900' : 'text-slate-500')
                    }
                  >
                    {s.label}
                  </span>
                </li>
              ))}
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
                Send with pay app to architect
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-400">
              State-changing actions are wired in a later session.
              The sworn statement advances in lockstep with the AIA pay app.
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
          (emphasis
            ? 'text-base font-semibold text-blue-700'
            : 'text-slate-900')
        }
      >
        {value}
      </dd>
    </div>
  );
}
