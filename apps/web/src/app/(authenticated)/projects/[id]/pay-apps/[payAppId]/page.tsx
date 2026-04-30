import Link from 'next/link';
import { ReviewTable } from './_components/review-table';

// GC Pay App Review. See gc-wireframes-brief.md § Screen 7.
//
// Phase B scope: clickable mock with realistic data inspired by the seed
// fixture (Brothers & Bricks, project 215, March 2026 sub pay app). Right-
// column PDF preview is deferred — supporting docs aren't uploaded yet.
// Approve / Request Revision are wired in a later session.

type PageProps = {
  params: Promise<{ id: string; payAppId: string }>;
};

export default async function ReviewPayAppPage({ params }: PageProps) {
  const { id: projectId } = await params;

  const mock = {
    contractor: 'Brothers & Bricks Masonry',
    period: 'March 1–31, 2026',
    submittedAt: 'Mar 31, 2026 at 4:42 PM',
    submitter: 'Maria Reyes (B&B office manager)',
    lines: [
      {
        id: 'line-3a',
        description: '3a — Stone & block delivery',
        currentAmount: 98400,
        previouslyBilled: 0,
        subReportedPercent: 85,
      },
      {
        id: 'line-3b',
        description: '3b — Masonry labor',
        currentAmount: 312800,
        previouslyBilled: 0,
        subReportedPercent: 40,
      },
      {
        id: 'line-3c',
        description: '3c — Mortar & grout materials',
        currentAmount: 87200,
        previouslyBilled: 0,
        subReportedPercent: 60,
      },
      {
        id: 'line-3d',
        description: '3d — Stored materials staging',
        currentAmount: 48222,
        previouslyBilled: 0,
        subReportedPercent: 15,
      },
      {
        id: 'line-3e',
        description: '3e — Closeout & cleanup',
        currentAmount: 30000,
        previouslyBilled: 0,
        subReportedPercent: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Review pay app — {mock.contractor}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Period {mock.period}. Submitted {mock.submittedAt} by {mock.submitter}.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/pay-apps`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Submitted</strong> — awaiting your review. The sub-reported
        column shows what they billed; the GC adjusted column is what you&rsquo;ll
        approve. Reduce a percentage only if you disagree, and add a note.
      </div>

      <ReviewTable lines={mock.lines} />
    </div>
  );
}
