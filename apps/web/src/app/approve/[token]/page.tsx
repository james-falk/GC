import { ApprovalForm } from './_components/approval-form';

// External magic-link approval. See gc-wireframes-brief.md § Screen 11.
// Public route — no Clerk auth. The architect/owner reaches this page via a
// link emailed to them; the [token] segment hashes to a magic_links row.
//
// Phase B scope: clickable mock with the AIA pay-app PDF embedded as the
// document under review. Real flow on the next pass: token -> magic_links
// row -> resolve target entity (CO / pay app / sworn statement) -> embed
// the right PDF -> on approve/reject, transition parent state machine
// and mark the link consumed.

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ApprovePage({ params }: PageProps) {
  await params;

  // For the mock, the magic-link points to the seeded AIA pay app.
  const pdfUrl = '/api/aia-pay-app/mock-aia-march-2026';
  const documentLabel = 'AIA pay application';
  const projectName = 'Lincoln Elementary Renovation Phase 2';
  const periodLabel = 'Period ending Mar 31, 2026';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Compact header */}
        <header className="mb-6 text-center sm:mb-8">
          <div className="text-sm font-semibold tracking-tight text-slate-900">
            constructor
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {documentLabel}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {projectName} · {periodLabel}
          </p>
        </header>

        {/* Document preview */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">Pay app — for your review</span>
            <a
              href={pdfUrl}
              download
              className="text-xs font-medium text-blue-700 transition hover:text-blue-800"
            >
              Download PDF
            </a>
          </div>
          <iframe
            src={pdfUrl}
            title="Document for approval"
            className="h-[60vh] w-full sm:h-[70vh]"
          />
        </div>

        {/* Approval form */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
          <ApprovalForm
            documentLabel={documentLabel}
            documentSubtitle="No account needed."
          />
        </div>

        {/* Trust footer */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Sent to you by Acme Construction Group via constructor. If you
          weren't expecting this, ignore the email.
        </p>
      </div>
    </main>
  );
}
