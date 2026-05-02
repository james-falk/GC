import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { hashToken } from '@/lib/magic-link';
import { ApprovalForm } from './_components/approval-form';

// External magic-link approval. See gc-wireframes-brief.md § Screen 11.
// Public route — no Clerk auth. The token in the URL is the bearer
// credential; we hash it and look up the magic_links row, verify it's
// unconsumed and unexpired, then render the document under review.
//
// Currently handles owner-role magic-links targeting change_orders.
// Other entity types (pay applications, sworn statements) and other roles
// (architect, sub_user) reuse this same shape with different content
// blocks — adding them is straightforward when those flows ship.

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function ApprovePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { status } = await searchParams;

  // Post-action success / rejection confirmation lands here on redirect.
  // The link is already consumed by this point.
  if (status === 'approved') {
    return <PostActionCard accent="emerald" title="Thank you." body="The contractor will be notified that you approved this change order." />;
  }
  if (status === 'rejected') {
    return <PostActionCard accent="amber" title="Changes requested." body="The contractor will be notified with your comment and will revise the change order." />;
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
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
    return <ErrorCard message="This link has expired. Ask the contractor to send a new one." />;
  }

  if (link.targetEntityType !== 'change_order' || link.recipientRole !== 'owner') {
    return (
      <ErrorCard message={`This kind of approval link (${link.targetEntityType} / ${link.recipientRole}) is not yet supported.`} />
    );
  }

  // Resolve the CO + project + affected subcontract for display context.
  const [co] = await db
    .select({
      coNumber: schema.changeOrders.coNumber,
      description: schema.changeOrders.description,
      justification: schema.changeOrders.justification,
      totalAmount: schema.changeOrders.totalAmount,
      projectName: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
      affectedSubcontractContractNumber: schema.subcontracts.contractNumber,
      affectedSubcontractorName: schema.subcontractors.name,
    })
    .from(schema.changeOrders)
    .innerJoin(schema.projects, eq(schema.changeOrders.projectId, schema.projects.id))
    .leftJoin(
      schema.subcontracts,
      eq(schema.changeOrders.affectedSubcontractId, schema.subcontracts.id),
    )
    .leftJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.changeOrders.id, link.targetEntityId),
        eq(schema.changeOrders.tenantId, link.tenantId),
      ),
    )
    .limit(1);

  if (!co) {
    return <ErrorCard message="The change order this link points to could not be found." />;
  }

  // Pull the line items so the owner can see what's being changed.
  const coLines = await db
    .select({
      sovLineNumber: schema.sovLines.lineNumber,
      sovDescription: schema.sovLines.description,
      deltaAmount: schema.changeOrderLines.deltaAmount,
      reason: schema.changeOrderLines.reason,
    })
    .from(schema.changeOrderLines)
    .innerJoin(
      schema.sovLines,
      eq(schema.changeOrderLines.sovLineId, schema.sovLines.id),
    )
    .where(eq(schema.changeOrderLines.changeOrderId, link.targetEntityId))
    .orderBy(asc(schema.sovLines.lineNumber));

  const totalNum = Number(co.totalAmount);
  const totalSign = totalNum > 0 ? '+' : totalNum < 0 ? '-' : '';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6 text-center sm:mb-8">
          <div className="text-sm font-semibold tracking-tight text-slate-900">
            constructor
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Change Order — {co.coNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {co.projectName} · Project #{co.projectNumber}
          </p>
        </header>

        {/* Summary card */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Description
              </dt>
              <dd className="mt-1 text-slate-900">{co.description}</dd>
            </div>
            {co.justification && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Justification
                </dt>
                <dd className="mt-1 whitespace-pre-line text-slate-700">{co.justification}</dd>
              </div>
            )}
            {co.affectedSubcontractContractNumber && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Affects subcontract
                </dt>
                <dd className="mt-1 text-slate-900">
                  {co.affectedSubcontractContractNumber}{' '}
                  <span className="text-slate-500">
                    — {co.affectedSubcontractorName}
                  </span>
                </dd>
              </div>
            )}
          </dl>

          {/* Line items */}
          {coLines.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Line items
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {coLines.map((l, i) => {
                  const delta = Number(l.deltaAmount);
                  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
                  return (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-900">
                          <span className="font-medium">{l.sovLineNumber}</span>{' '}
                          <span>{l.sovDescription}</span>
                        </div>
                        {l.reason && (
                          <div className="text-xs text-slate-500">{l.reason}</div>
                        )}
                      </div>
                      <div
                        className={
                          'tabular-nums text-sm font-semibold ' +
                          (delta > 0
                            ? 'text-emerald-700'
                            : delta < 0
                              ? 'text-red-700'
                              : 'text-slate-400')
                        }
                      >
                        {sign}${formatMoney(Math.abs(delta))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Total */}
          <div className="mt-5 flex items-baseline justify-between rounded-md bg-slate-50 px-3 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total impact
            </span>
            <span
              className={
                'text-base font-semibold tabular-nums ' +
                (totalNum > 0
                  ? 'text-emerald-700'
                  : totalNum < 0
                    ? 'text-red-700'
                    : 'text-slate-400')
              }
            >
              {totalSign}${formatMoney(Math.abs(totalNum))}
            </span>
          </div>
        </div>

        {/* Approval form */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
          <ApprovalForm token={token} />
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          This link expires {formatExpiry(link.expiresAt)}. Single-use — once
          you act, the link can&rsquo;t be used again.
        </p>
      </div>
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
          <p className="mt-3 text-[11px] opacity-70">
            You can close this tab — no further action needed.
          </p>
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

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatExpiry(expiresAt: Date | string): string {
  const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
