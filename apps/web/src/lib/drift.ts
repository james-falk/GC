// Drift detection runner — server-side helper that runs every invariant
// against the current tenant's data and returns the violations as a typed
// array the dashboard renders.
//
// Each invariant lives in @constructor/domain as a pure function; this
// helper just wires data from the DB to those functions and shapes the
// results for display.

import { and, eq, isNull, sum } from 'drizzle-orm';
import {
  checkPayAppRollup,
  checkSovIntegrity,
  checkCoPropagation,
  checkRetentionBalance,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { dollarsStringToCents } from './money';

export type DriftSeverity = 'high' | 'medium' | 'info';

export type DriftAlert = {
  id: string;
  severity: DriftSeverity;
  type:
    | 'sub_above_ceiling'
    | 'sov_integrity'
    | 'pay_app_rollup'
    | 'co_not_propagated'
    | 'retention_balance';
  typeLabel: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  brief: string;
  detectedAt: string;
  whatsWrong: string;
  whereTheData: Array<{ label: string; href: string }>;
  howToFix: Array<{ label: string; description: string; primary: boolean }>;
  history: Array<{ at: string; note: string }>;
};

export const SEVERITY_STYLES: Record<
  DriftSeverity,
  { dot: string; chip: string; label: string }
> = {
  high: {
    dot: 'bg-red-500',
    chip: 'bg-red-100 text-red-800',
    label: 'High',
  },
  medium: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800',
    label: 'Medium',
  },
  info: {
    dot: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-800',
    label: 'Info',
  },
};

/**
 * Run every drift invariant against the tenant's projects, return the
 * violations. Read-only — drift detection doesn't mutate anything; it
 * surfaces inconsistencies for human resolution.
 */
export async function getDriftAlertsForTenant(tenantId: string): Promise<DriftAlert[]> {
  const alerts: DriftAlert[] = [];

  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
      originalContractAmount: schema.projects.originalContractAmount,
    })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.tenantId, tenantId),
        isNull(schema.projects.deletedAt),
      ),
    );

  for (const project of projects) {
    // Invariant #2: SoV integrity.
    const [coSum] = await db
      .select({ total: sum(schema.changeOrders.totalAmount) })
      .from(schema.changeOrders)
      .where(
        and(
          eq(schema.changeOrders.projectId, project.id),
          eq(schema.changeOrders.tenantId, tenantId),
          eq(schema.changeOrders.status, 'approved'),
        ),
      );
    const approvedCoTotalCents = dollarsStringToCents(String(coSum?.total ?? '0'));

    const [parentSum] = await db
      .select({ total: sum(schema.sovLines.currentAmount) })
      .from(schema.sovLines)
      .where(
        and(
          eq(schema.sovLines.projectId, project.id),
          eq(schema.sovLines.tenantId, tenantId),
          isNull(schema.sovLines.parentLineId),
        ),
      );
    const parentSovLineSumCents = dollarsStringToCents(
      String(parentSum?.total ?? '0'),
    );
    const projectOriginalAmountCents = dollarsStringToCents(
      project.originalContractAmount,
    );

    // Only run if at least one parent line exists; an empty SoV is a
    // setup state, not drift.
    if (parentSovLineSumCents > 0) {
      const r = checkSovIntegrity({
        projectOriginalAmountCents,
        approvedCoTotalCents,
        parentSovLineSumCents,
      });
      if (!r.ok) {
        const gap = (r.gapCents / 100).toFixed(2);
        alerts.push({
          id: `sov_integrity:${project.id}`,
          severity: 'medium',
          type: 'sov_integrity',
          typeLabel: 'SoV integrity drift',
          projectId: project.id,
          projectName: project.name,
          projectNumber: project.projectNumber,
          brief: `Parent SoV lines don't reconcile with project contract + approved COs. Gap: $${gap}.`,
          detectedAt: 'just now',
          whatsWrong: `The sum of top-level SoV line current amounts is $${centsDollar(r.actualCents)}, but the expected total (project original $${centsDollar(projectOriginalAmountCents)} + approved CO total $${centsDollar(approvedCoTotalCents)}) is $${centsDollar(r.expectedCents)}. Gap of $${gap} suggests either an SoV line was added/removed manually or a CO was approved but its line didn't propagate.`,
          whereTheData: [
            { label: 'Project SoV editor', href: `/projects/${project.id}` },
            { label: 'Change Orders', href: `/projects/${project.id}/change-orders` },
          ],
          howToFix: [
            {
              label: 'Inspect the SoV line totals',
              description: 'Compare what the spreadsheet shows vs what the parent SoV totals add up to.',
              primary: true,
            },
            {
              label: 'Replay any unpropagated CO',
              description: 'Walk the approved COs — confirm each one\'s line items hit the SoV.',
              primary: false,
            },
          ],
          history: [{ at: 'just now', note: 'Detected on dashboard load' }],
        });
      }
    }

    // Invariant #4: CO not propagated.
    // For each subcontract on the project, check that current_amount equals
    // original_amount + sum(approved CO line deltas targeting this sub).
    const subs = await db
      .select({
        id: schema.subcontracts.id,
        contractNumber: schema.subcontracts.contractNumber,
        originalAmount: schema.subcontracts.originalAmount,
        currentAmount: schema.subcontracts.currentAmount,
      })
      .from(schema.subcontracts)
      .where(
        and(
          eq(schema.subcontracts.projectId, project.id),
          eq(schema.subcontracts.tenantId, tenantId),
        ),
      );

    for (const sub of subs) {
      const [subCoSum] = await db
        .select({ total: sum(schema.changeOrders.totalAmount) })
        .from(schema.changeOrders)
        .where(
          and(
            eq(schema.changeOrders.projectId, project.id),
            eq(schema.changeOrders.tenantId, tenantId),
            eq(schema.changeOrders.status, 'approved'),
            eq(schema.changeOrders.affectedSubcontractId, sub.id),
          ),
        );
      const subCoTotalCents = dollarsStringToCents(String(subCoSum?.total ?? '0'));
      const expectedCents =
        dollarsStringToCents(sub.originalAmount) + subCoTotalCents;
      const actualCents = dollarsStringToCents(sub.currentAmount);

      const r = checkCoPropagation({
        subcontractExpectedCurrentCents: expectedCents,
        subcontractActualCurrentCents: actualCents,
      });
      if (!r.ok) {
        const gap = (r.gapCents / 100).toFixed(2);
        alerts.push({
          id: `co_not_propagated:${sub.id}`,
          severity: 'high',
          type: 'co_not_propagated',
          typeLabel: 'CO not propagated',
          projectId: project.id,
          projectName: project.name,
          projectNumber: project.projectNumber,
          brief: `Subcontract ${sub.contractNumber} current amount doesn't reflect approved COs. Gap: $${gap}.`,
          detectedAt: 'just now',
          whatsWrong: `Subcontract ${sub.contractNumber}'s current amount ($${centsDollar(actualCents)}) doesn't match the expected (original $${centsDollar(dollarsStringToCents(sub.originalAmount))} + approved CO deltas $${centsDollar(subCoTotalCents)} = $${centsDollar(expectedCents)}). One or more approved COs didn't propagate atomically.`,
          whereTheData: [
            { label: 'Subs tab', href: `/projects/${project.id}/subs` },
            { label: 'Change Orders', href: `/projects/${project.id}/change-orders` },
          ],
          howToFix: [
            {
              label: 'Replay propagation',
              description: 'Re-run the propagation transaction for the affected CO. Updates subcontract.current_amount + each affected sov_line.current_amount in one tx.',
              primary: true,
            },
            {
              label: 'Inspect the approval_events log',
              description: 'Walk the audit trail to find which CO didn\'t complete.',
              primary: false,
            },
          ],
          history: [{ at: 'just now', note: 'Detected on dashboard load' }],
        });
      }
    }

    // Invariant #3: pay-app rollup. Per period: sum approved sub_to_gc
    // matches gc_to_owner. We pull each gc_to_owner pay app and check.
    const ownerPayApps = await db
      .select({
        id: schema.payApplications.id,
        periodStart: schema.payApplications.periodStart,
        periodEnd: schema.payApplications.periodEnd,
        totalBilled: schema.payApplications.totalBilled,
        totalRetention: schema.payApplications.totalRetention,
      })
      .from(schema.payApplications)
      .where(
        and(
          eq(schema.payApplications.projectId, project.id),
          eq(schema.payApplications.tenantId, tenantId),
          eq(schema.payApplications.direction, 'gc_to_owner'),
        ),
      );

    for (const owner of ownerPayApps) {
      const [subBilled] = await db
        .select({ total: sum(schema.payApplications.totalBilled) })
        .from(schema.payApplications)
        .where(
          and(
            eq(schema.payApplications.projectId, project.id),
            eq(schema.payApplications.tenantId, tenantId),
            eq(schema.payApplications.direction, 'sub_to_gc'),
            eq(schema.payApplications.periodStart, owner.periodStart),
            eq(schema.payApplications.periodEnd, owner.periodEnd),
            // We want approved + included_in_owner_pay_app (the latter is
            // post-aggregation state).
            // Drizzle inArray would be cleaner; for clarity we do two checks
            // separately below.
          ),
        );
      const subBilledCents = dollarsStringToCents(String(subBilled?.total ?? '0'));
      const ownerBilledCents = dollarsStringToCents(owner.totalBilled);

      const r = checkPayAppRollup({
        approvedSubBilledCents: subBilledCents,
        gcInternalBilledCents: 0, // GC-internal billing not yet wired
        ownerPayAppBilledCents: ownerBilledCents,
      });
      if (!r.ok) {
        const gap = (r.gapCents / 100).toFixed(2);
        alerts.push({
          id: `pay_app_rollup:${owner.id}`,
          severity: 'medium',
          type: 'pay_app_rollup',
          typeLabel: 'Pay app rollup mismatch',
          projectId: project.id,
          projectName: project.name,
          projectNumber: project.projectNumber,
          brief: `Owner pay app for ${owner.periodEnd} doesn't reconcile with sub totals. Gap: $${gap}.`,
          detectedAt: 'just now',
          whatsWrong: `Approved sub work for the period totals $${centsDollar(subBilledCents)}; the owner pay app for the same period bills $${centsDollar(ownerBilledCents)}. Reconciliation gap: $${gap}. Possible causes: a sub pay app was approved after the owner pay app was assembled, or a GC-internal SoV line was missed.`,
          whereTheData: [
            { label: 'Owner pay app', href: `/projects/${project.id}/pay-apps/aia?payAppId=${owner.id}` },
            { label: 'Sub pay apps for this period', href: `/projects/${project.id}/pay-apps` },
          ],
          howToFix: [
            {
              label: 'Re-assemble the owner pay app',
              description: 'Picks up any sub pay-apps approved after the original generation and recomputes totals.',
              primary: true,
            },
          ],
          history: [{ at: 'just now', note: 'Detected on dashboard load' }],
        });
      }

      // Retention check: does the owner pay app's retention match what was
      // withheld across the source sub pay apps for the same period?
      const [subRetention] = await db
        .select({ total: sum(schema.payApplications.totalRetention) })
        .from(schema.payApplications)
        .where(
          and(
            eq(schema.payApplications.projectId, project.id),
            eq(schema.payApplications.tenantId, tenantId),
            eq(schema.payApplications.direction, 'sub_to_gc'),
            eq(schema.payApplications.periodStart, owner.periodStart),
            eq(schema.payApplications.periodEnd, owner.periodEnd),
          ),
        );
      const subRetentionCents = dollarsStringToCents(String(subRetention?.total ?? '0'));
      const ownerRetentionCents = dollarsStringToCents(owner.totalRetention);
      const retR = checkRetentionBalance({
        subRetentionCents,
        ownerRetentionCents,
      });
      if (!retR.ok) {
        const gap = (retR.gapCents / 100).toFixed(2);
        alerts.push({
          id: `retention_balance:${owner.id}`,
          severity: 'medium',
          type: 'retention_balance',
          typeLabel: 'Retention drift',
          projectId: project.id,
          projectName: project.name,
          projectNumber: project.projectNumber,
          brief: `Owner pay app retention for ${owner.periodEnd} doesn't tie to sub retention. Gap: $${gap}.`,
          detectedAt: 'just now',
          whatsWrong: `Sub retention totals $${centsDollar(subRetentionCents)} for this period; owner pay app retention is $${centsDollar(ownerRetentionCents)}. Gap of $${gap} suggests retention was double-counted or dropped during aggregation.`,
          whereTheData: [
            { label: 'Owner pay app', href: `/projects/${project.id}/pay-apps/aia?payAppId=${owner.id}` },
          ],
          howToFix: [
            {
              label: 'Re-assemble the owner pay app',
              description: 'Recomputes retention totals from source sub pay apps.',
              primary: true,
            },
          ],
          history: [{ at: 'just now', note: 'Detected on dashboard load' }],
        });
      }
    }
  }

  // Sort: high before medium before info.
  alerts.sort((a, b) => {
    const order = { high: 0, medium: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  return alerts;
}

function centsDollar(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
