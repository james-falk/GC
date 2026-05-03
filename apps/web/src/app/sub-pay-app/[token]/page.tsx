import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { hashToken, TOKEN_PATTERN } from '@/lib/magic-link';
import { SubPayAppForm } from './_components/sub-pay-app-form';

// Sub pay-app portal — public route, no Clerk auth. The token in the URL
// is the bearer credential; we hash it, look up the magic_links row,
// verify it's unconsumed and unexpired, then render the sub's actual SoV
// lines (joined through the subcontract).
//
// See gc-wireframes-brief.md § Screen 6.

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function SubPayAppPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { status } = await searchParams;

  if (status === 'submitted') {
    return (
      <PostActionCard
        accent="emerald"
        title="Submitted."
        body="Your pay app is in the GC's queue for review. They'll either approve it or send it back with a comment. The link can't be reused."
      />
    );
  }

  if (!TOKEN_PATTERN.test(token)) {
    return <ErrorCard message="This link is malformed." />;
  }

  const tokenHash = hashToken(token);
  const [link] = await db
    .select()
    .from(schema.magicLinks)
    .where(eq(schema.magicLinks.tokenHash, tokenHash))
    .limit(1);

  if (!link) {
    return <ErrorCard message="This link is no longer valid." />;
  }
  if (link.consumedAt) {
    return <ErrorCard message="This link has already been used." />;
  }
  if (new Date(link.expiresAt).getTime() < Date.now()) {
    return <ErrorCard message="This link has expired. Ask the GC to send a new one." />;
  }
  if (
    link.targetEntityType !== 'pay_application' ||
    link.recipientRole !== 'sub_user'
  ) {
    return (
      <ErrorCard
        message={`This kind of link (${link.targetEntityType} / ${link.recipientRole}) doesn't belong on the sub pay-app portal.`}
      />
    );
  }

  // Resolve the pay app + project + sub + this sub's SoV lines.
  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
      periodStart: schema.payApplications.periodStart,
      periodEnd: schema.payApplications.periodEnd,
      subcontractId: schema.payApplications.subcontractId,
    })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.id, link.targetEntityId),
        eq(schema.payApplications.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!payApp || !payApp.subcontractId) {
    return <ErrorCard message="The pay app this link points to could not be found." />;
  }

  const [subContext] = await db
    .select({
      contractNumber: schema.subcontracts.contractNumber,
      currentAmount: schema.subcontracts.currentAmount,
      subcontractorName: schema.subcontractors.name,
      projectName: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .innerJoin(
      schema.projects,
      eq(schema.subcontracts.projectId, schema.projects.id),
    )
    .where(eq(schema.subcontracts.id, payApp.subcontractId))
    .limit(1);
  if (!subContext) {
    return <ErrorCard message="Subcontract context not found." />;
  }

  // SoV lines belonging to this sub's subcontract — these are the only
  // lines this sub can bill against. Includes children of any parent line
  // attached to the same subcontract.
  const sovLines = await db
    .select({
      id: schema.sovLines.id,
      lineNumber: schema.sovLines.lineNumber,
      description: schema.sovLines.description,
      currentAmount: schema.sovLines.currentAmount,
    })
    .from(schema.sovLines)
    .where(
      and(
        eq(schema.sovLines.subcontractId, payApp.subcontractId),
        eq(schema.sovLines.tenantId, link.tenantId),
      ),
    )
    .orderBy(asc(schema.sovLines.lineNumber));

  // Previously-billed lookup per SoV line. Sums all approved sub_to_gc
  // pay-app lines for prior periods on this same subcontract. (For Phase 1
  // simplicity, we treat pre-period billing as 0 here; a richer rollup is a
  // follow-up.)
  // TODO: real previously-billed query against approved pay-app lines.
  const previouslyBilledById = new Map<string, number>();

  const lines = sovLines.map((l) => ({
    id: l.id,
    description: `${l.lineNumber} — ${l.description}`,
    currentAmount: Number(l.currentAmount),
    previouslyBilled: previouslyBilledById.get(l.id) ?? 0,
  }));

  if (lines.length === 0) {
    return (
      <ErrorCard message="No SoV lines are attached to your subcontract yet. Please contact the GC." />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <SubPayAppForm
        token={token}
        projectName={subContext.projectName}
        projectNumber={subContext.projectNumber}
        contractor={subContext.subcontractorName}
        contractNumber={subContext.contractNumber}
        period={formatPeriod(payApp.periodStart, payApp.periodEnd)}
        contractAmount={Number(subContext.currentAmount)}
        lines={lines}
        statusLabel={payApp.status}
      />
    </main>
  );
}

function PostActionCard({
  accent,
  title,
  body,
}: {
  accent: 'emerald' | 'amber';
  title: string;
  body: string;
}) {
  const styles =
    accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className={`rounded-lg border ${styles} px-6 py-8 text-center`}>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm">{body}</p>
        </div>
      </div>
    </main>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </div>
      </div>
    </main>
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
