import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ApprovalTrail } from './_components/approval-trail';
import { COForm } from './_components/co-form';

// Change Order create. See gc-wireframes-brief.md § Screen 8.
//
// Step 4 of the backend persistence pass: subcontract + line dropdowns now
// read real data from this project. Save Draft + Submit are still wired
// in a later step when the CO state-machine reducer + atomic propagation
// transaction land.
//
// initialRows is empty — the user picks a subcontract and adds line items
// to delta against. (The previous mock pre-filled three rows from the
// seeded CO 215-CO-001; that's no longer realistic now that real data
// drives the form.)

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewChangeOrderPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const tenant = await getCurrentTenant();

  // Subcontracts on this project with the subcontractor name for display.
  const subs = await db
    .select({
      id: schema.subcontracts.id,
      contractNumber: schema.subcontracts.contractNumber,
      subcontractorName: schema.subcontractors.name,
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.subcontracts.projectId, projectId),
        eq(schema.subcontracts.tenantId, tenant.id),
      ),
    )
    .orderBy(asc(schema.subcontracts.contractNumber));

  // SoV lines for this project that are attached to a subcontract. Lines
  // with subcontractId === null are GC-internal and not target-able by a
  // CO that selects a subcontract.
  const sovLines = await db
    .select({
      id: schema.sovLines.id,
      lineNumber: schema.sovLines.lineNumber,
      description: schema.sovLines.description,
      subcontractId: schema.sovLines.subcontractId,
    })
    .from(schema.sovLines)
    .where(
      and(
        eq(schema.sovLines.projectId, projectId),
        eq(schema.sovLines.tenantId, tenant.id),
      ),
    )
    .orderBy(asc(schema.sovLines.lineNumber));

  const linesBySubcontract = new Map<
    string,
    Array<{ id: string; display: string }>
  >();
  for (const l of sovLines) {
    if (!l.subcontractId) continue;
    const arr = linesBySubcontract.get(l.subcontractId) ?? [];
    arr.push({
      id: l.id,
      display: `${l.lineNumber} — ${l.description}`,
    });
    linesBySubcontract.set(l.subcontractId, arr);
  }

  const subOptions = subs.map((s) => ({
    id: s.id,
    contractNumber: s.contractNumber,
    name: s.subcontractorName,
    lines: linesBySubcontract.get(s.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Draft change order</h2>
          <p className="text-sm text-slate-600">
            Routes through Principal → Architect → Owner. On owner approval the
            system propagates atomically to the affected subcontract and SoV lines.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/change-orders`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {subs.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">No subcontracts on this project yet.</p>
          <p className="mt-1 text-amber-800">
            A change order targets an existing subcontract. Add at least one
            subcontract before drafting a CO.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/projects/${projectId}/subs/new`}
              className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              + Add subcontract
            </Link>
            <Link
              href={`/projects/${projectId}/change-orders`}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <COForm
              projectId={projectId}
              coNumberSuggestion="CO-001"
              subOptions={subOptions}
              initialRows={[]}
            />
          </div>
          <div className="lg:col-span-2">
            <ApprovalTrail />
          </div>
        </div>
      )}
    </div>
  );
}
