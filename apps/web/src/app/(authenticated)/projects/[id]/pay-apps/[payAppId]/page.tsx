import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ReviewTable } from './_components/review-table';

// GC Pay App Review. Real query, no mocks. See gc-wireframes-brief.md § 7.

const STATUS_BANNER: Record<
  string,
  { color: string; label: string; body: string }
> = {
  draft: {
    color: 'bg-slate-50 border-slate-200 text-slate-700',
    label: 'Draft',
    body: 'Sub hasn\'t submitted yet — the percentages here are zero.',
  },
  submitted: {
    color: 'bg-amber-50 border-amber-200 text-amber-900',
    label: 'Submitted',
    body: 'Awaiting your review. Sub-reported is what they billed; GC adjusted is what you\'ll approve. Reduce a percentage only if you disagree, and add a note.',
  },
  needs_revision: {
    color: 'bg-orange-50 border-orange-200 text-orange-900',
    label: 'Needs revision',
    body: 'You sent this back. Sub will edit and re-submit through their magic-link.',
  },
  approved: {
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    label: 'Approved',
    body: 'Approved by PM. Will roll into the next owner pay app for this period.',
  },
};

type PageProps = {
  params: Promise<{ id: string; payAppId: string }>;
};

export default async function ReviewPayAppPage({ params }: PageProps) {
  const { id: projectId, payAppId } = await params;
  const tenant = await getCurrentTenant();

  // Pay app + sub context.
  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
      direction: schema.payApplications.direction,
      periodStart: schema.payApplications.periodStart,
      periodEnd: schema.payApplications.periodEnd,
      submittedAt: schema.payApplications.submittedAt,
      subcontractName: schema.subcontractors.name,
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
        eq(schema.payApplications.id, payAppId),
        eq(schema.payApplications.projectId, projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!payApp) notFound();

  // Pay-app lines joined to their SoV line for description.
  const lines = await db
    .select({
      id: schema.payApplicationLines.id,
      sovLineId: schema.payApplicationLines.sovLineId,
      previouslyBilledAmount: schema.payApplicationLines.previouslyBilledAmount,
      subReportedPercent: schema.payApplicationLines.subReportedPercent,
      gcAdjustedPercent: schema.payApplicationLines.gcAdjustedPercent,
      thisPeriodAmount: schema.payApplicationLines.thisPeriodAmount,
      sovLineNumber: schema.sovLines.lineNumber,
      sovDescription: schema.sovLines.description,
      sovCurrentAmount: schema.sovLines.currentAmount,
    })
    .from(schema.payApplicationLines)
    .innerJoin(
      schema.sovLines,
      eq(schema.payApplicationLines.sovLineId, schema.sovLines.id),
    )
    .where(eq(schema.payApplicationLines.payApplicationId, payAppId))
    .orderBy(asc(schema.sovLines.lineNumber));

  const banner = STATUS_BANNER[payApp.status] ?? {
    color: 'bg-slate-50 border-slate-200 text-slate-700',
    label: payApp.status,
    body: '',
  };

  const reviewLines = lines.map((l) => ({
    id: l.id,
    sovLineId: l.sovLineId,
    description: `${l.sovLineNumber} — ${l.sovDescription}`,
    currentAmount: Number(l.sovCurrentAmount),
    previouslyBilled: Number(l.previouslyBilledAmount),
    subReportedPercent: Number(l.subReportedPercent),
    initialGcAdjustedPercent: Number(l.gcAdjustedPercent),
  }));

  const editable = payApp.status === 'submitted';

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Review pay app — {payApp.subcontractName ?? 'Unknown sub'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Period {formatPeriod(payApp.periodStart, payApp.periodEnd)}.
            Contract {payApp.contractNumber ?? '—'}.{' '}
            {payApp.submittedAt
              ? `Submitted ${new Date(payApp.submittedAt).toLocaleString()}.`
              : 'Not yet submitted.'}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/pay-apps`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      <div className={`rounded-md border px-3 py-2 text-xs ${banner.color}`}>
        <strong>{banner.label}</strong>
        {banner.body && ` — ${banner.body}`}
      </div>

      {reviewLines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">
            No line items on this pay app yet.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            The sub fills these in through their magic-link portal.
          </p>
        </div>
      ) : (
        <ReviewTable
          payAppId={payApp.id}
          projectId={projectId}
          lines={reviewLines}
          editable={editable}
        />
      )}
    </div>
  );
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
