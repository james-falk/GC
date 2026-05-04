import Link from 'next/link';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { getDriftAlertsForTenant } from '@/lib/drift';

// Tenant dashboard. The morning landing page — Riley signs in and the
// queue is right there. Each metric tile is a link into the cross-project
// view filtered to that exact slice.
//
// Five tiles + a recent-activity stream. The numbers come from the same
// queries the per-feature pages use, so a click into a tile lands on a
// list that matches the count.

export default async function DashboardPage() {
  const tenant = await getCurrentTenant();

  const [
    activeProjects,
    payAppsAwaiting,
    cosInChain,
    driftAlerts,
    recentEvents,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.tenantId, tenant.id),
          isNull(schema.projects.deletedAt),
        ),
      ),
    // Pay apps awaiting either GC review (sub_to_gc submitted) or owner
    // sign-off (gc_to_owner sent_to_owner). The "what's on my desk" count.
    db
      .select({ value: count() })
      .from(schema.payApplications)
      .innerJoin(
        schema.projects,
        and(
          eq(schema.payApplications.projectId, schema.projects.id),
          isNull(schema.projects.deletedAt),
        ),
      )
      .where(
        and(
          eq(schema.payApplications.tenantId, tenant.id),
          inArray(schema.payApplications.status, ['submitted', 'sent_to_owner']),
        ),
      ),
    // COs in the approval chain — pending_principal / pending_architect /
    // pending_owner. Each represents an external-facing action waiting.
    db
      .select({ value: count() })
      .from(schema.changeOrders)
      .innerJoin(
        schema.projects,
        and(
          eq(schema.changeOrders.projectId, schema.projects.id),
          isNull(schema.projects.deletedAt),
        ),
      )
      .where(
        and(
          eq(schema.changeOrders.tenantId, tenant.id),
          inArray(schema.changeOrders.status, [
            'pending_principal',
            'pending_architect',
            'pending_owner',
          ]),
        ),
      ),
    getDriftAlertsForTenant(tenant.id),
    db
      .select({
        id: schema.approvalEvents.id,
        entityType: schema.approvalEvents.entityType,
        entityId: schema.approvalEvents.entityId,
        fromStatus: schema.approvalEvents.fromStatus,
        toStatus: schema.approvalEvents.toStatus,
        actorType: schema.approvalEvents.actorType,
        actorExternalEmail: schema.approvalEvents.actorExternalEmail,
        comment: schema.approvalEvents.comment,
        createdAt: schema.approvalEvents.createdAt,
        actorEmail: schema.users.email,
      })
      .from(schema.approvalEvents)
      .leftJoin(
        schema.users,
        eq(schema.approvalEvents.actorUserId, schema.users.id),
      )
      .where(eq(schema.approvalEvents.tenantId, tenant.id))
      .orderBy(desc(schema.approvalEvents.createdAt))
      .limit(15),
  ]);

  const projectCount = activeProjects[0]?.value ?? 0;
  const payAppCount = payAppsAwaiting[0]?.value ?? 0;
  const coCount = cosInChain[0]?.value ?? 0;
  const driftHigh = driftAlerts.filter((a) => a.severity === 'high').length;
  const driftTotal = driftAlerts.length;

  const tiles = [
    {
      label: 'Active projects',
      value: projectCount,
      href: '/projects',
      tone: 'slate' as const,
      caption: projectCount === 1 ? 'project' : 'projects',
    },
    {
      label: 'Pay apps awaiting review',
      value: payAppCount,
      href: '/pay-apps?filter=awaiting',
      tone: 'amber' as const,
      caption: payAppCount === 1 ? 'submission' : 'submissions',
    },
    {
      label: 'COs in approval chain',
      value: coCount,
      href: '/change-orders?filter=in_chain',
      tone: 'blue' as const,
      caption: coCount === 1 ? 'change order' : 'change orders',
    },
    {
      label: 'Drift violations',
      value: driftTotal,
      href: '/drift',
      tone: driftHigh > 0 ? ('red' as const) : ('emerald' as const),
      caption:
        driftTotal === 0
          ? 'system consistent'
          : `${driftHigh} high · ${driftTotal - driftHigh} low`,
    },
  ];

  const TONE_CLASSES: Record<string, string> = {
    slate: 'border-slate-200 bg-white',
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
    red: 'border-red-200 bg-red-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          What&rsquo;s on your desk. Click any number to drill in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={
              'block rounded-lg border px-5 py-4 transition hover:shadow-sm ' +
              TONE_CLASSES[t.tone]
            }
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {t.value}
            </div>
            <div className="mt-1 text-xs text-slate-600">{t.caption}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent activity
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No activity yet. State transitions across COs, pay apps, and
                sworn statements appear here.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentEvents.map((e) => (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <span className="font-medium text-slate-900">
                            {ENTITY_LABELS[e.entityType] ?? e.entityType}
                          </span>
                          <span className="text-slate-500"> · </span>
                          {e.fromStatus && (
                            <>
                              <span className="text-slate-500">{e.fromStatus}</span>
                              <span className="mx-1.5 text-slate-400">→</span>
                            </>
                          )}
                          <span className="font-medium text-slate-900">
                            {e.toStatus}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {actorLabel(e)}
                          {e.comment && (
                            <>
                              <span className="mx-1.5">·</span>
                              <span className="italic">{truncate(e.comment, 80)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] tabular-nums text-slate-400">
                        {relativeTime(e.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Quick links
          </h2>
          <div className="mt-3 space-y-2">
            <QuickLink
              href="/projects"
              label="Projects"
              caption="All active projects"
            />
            <QuickLink
              href="/pay-apps?filter=awaiting"
              label="Pay apps awaiting review"
              caption="Submitted by subs, sent to owners"
            />
            <QuickLink
              href="/change-orders?filter=in_chain"
              label="COs in approval chain"
              caption="Waiting on Principal / Architect / Owner"
            />
            <QuickLink
              href="/drift"
              label="Drift dashboard"
              caption="Invariant violations across all projects"
            />
            <QuickLink
              href="/exports"
              label="Exports"
              caption="QuickBooks AP + AR CSV"
            />
            <QuickLink
              href="/team"
              label="Team"
              caption="Invite teammates, manage roles"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const ENTITY_LABELS: Record<string, string> = {
  pay_application: 'Pay app',
  change_order: 'Change order',
  sworn_statement: 'Sworn statement',
};

function actorLabel(e: {
  actorType: string;
  actorEmail: string | null;
  actorExternalEmail: string | null;
}): string {
  if (e.actorType === 'system') return 'System';
  if (e.actorType === 'external_invitee') {
    return e.actorExternalEmail
      ? `External — ${e.actorExternalEmail}`
      : 'External invitee';
  }
  return e.actorEmail ?? 'Internal user';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function QuickLink({
  href,
  label,
  caption,
}: {
  href: string;
  label: string;
  caption: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-slate-200 bg-white px-3 py-2.5 transition hover:bg-slate-50"
    >
      <div className="text-sm font-medium text-slate-900">{label}</div>
      <div className="text-[11px] text-slate-500">{caption}</div>
    </Link>
  );
}
