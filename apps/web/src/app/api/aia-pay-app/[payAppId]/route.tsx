import { NextResponse } from 'next/server';
import { Document, renderToBuffer } from '@react-pdf/renderer';
import { and, asc, eq, lt, sum } from 'drizzle-orm';
import {
  AiaG702Page,
  AiaG703Page,
  type AiaG702Data,
  type AiaG703Line,
} from '@constructor/pdf';
import { db, schema } from '@constructor/db';

// PDF download endpoint for an AIA pay app — G702 cover sheet (page 1)
// + G703 continuation sheet (page 2). All numbers come from the real
// pay_applications row, joined to project + parties + lines.
//
// SECURITY NOTE: this route is currently public so the magic-link
// /approve/[token] page can embed the PDF in an iframe (the consumer
// has no Clerk session). UUID-as-bearer is acceptable for MVP demo
// since pay-app ids aren't enumerable. Real fix: gate with a per-doc
// access token issued at magic-link generation.

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ payAppId: string }> },
): Promise<Response> {
  const { payAppId } = await params;

  // Resolve the owner pay-app + project + parties.
  const [row] = await db
    .select({
      payAppId: schema.payApplications.id,
      direction: schema.payApplications.direction,
      periodEnd: schema.payApplications.periodEnd,
      totalBilled: schema.payApplications.totalBilled,
      totalRetention: schema.payApplications.totalRetention,
      createdAt: schema.payApplications.createdAt,
      tenantId: schema.payApplications.tenantId,
      projectId: schema.payApplications.projectId,
      projectName: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
      projectStartDate: schema.projects.startDate,
      originalContractAmount: schema.projects.originalContractAmount,
      ownerId: schema.projects.ownerId,
      architectId: schema.projects.architectId,
      tenantName: schema.tenants.name,
    })
    .from(schema.payApplications)
    .innerJoin(
      schema.projects,
      eq(schema.payApplications.projectId, schema.projects.id),
    )
    .innerJoin(
      schema.tenants,
      eq(schema.payApplications.tenantId, schema.tenants.id),
    )
    .where(eq(schema.payApplications.id, payAppId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Pay app not found' }, { status: 404 });
  }
  if (row.direction !== 'gc_to_owner') {
    return NextResponse.json(
      { error: 'AIA PDF is only generated for gc_to_owner pay apps' },
      { status: 400 },
    );
  }

  // Owner + architect names (each optional).
  const orgIds = [row.ownerId, row.architectId].filter(
    (i): i is string => Boolean(i),
  );
  const orgs =
    orgIds.length > 0
      ? await db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.tenantId, row.tenantId))
      : [];
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
  const ownerName = row.ownerId ? orgNameById.get(row.ownerId) ?? 'Unknown owner' : '—';
  const architectName = row.architectId
    ? orgNameById.get(row.architectId) ?? 'Unknown architect'
    : '—';

  // Application number: count of gc_to_owner pay apps for this project up
  // to and including this one, ordered by createdAt.
  const allOwnerPayApps = await db
    .select({
      id: schema.payApplications.id,
      createdAt: schema.payApplications.createdAt,
      totalBilled: schema.payApplications.totalBilled,
    })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, row.projectId),
        eq(schema.payApplications.tenantId, row.tenantId),
        eq(schema.payApplications.direction, 'gc_to_owner'),
      ),
    )
    .orderBy(asc(schema.payApplications.createdAt));
  const applicationNumber =
    String(allOwnerPayApps.findIndex((p) => p.id === row.payAppId) + 1).padStart(
      2,
      '0',
    );

  // Net change by approved COs against this project.
  const [coTotals] = await db
    .select({
      total: sum(schema.changeOrders.totalAmount),
    })
    .from(schema.changeOrders)
    .where(
      and(
        eq(schema.changeOrders.projectId, row.projectId),
        eq(schema.changeOrders.tenantId, row.tenantId),
        eq(schema.changeOrders.status, 'approved'),
      ),
    );
  const netChangeByCO = Number(coTotals?.total ?? 0);
  const originalContractSum = Number(row.originalContractAmount);
  const contractSumToDate = originalContractSum + netChangeByCO;

  // Less previous certificates: sum of totalBilled of every PRIOR
  // gc_to_owner pay app (createdAt strictly before this one).
  const [prevTotals] = await db
    .select({ total: sum(schema.payApplications.totalBilled) })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, row.projectId),
        eq(schema.payApplications.tenantId, row.tenantId),
        eq(schema.payApplications.direction, 'gc_to_owner'),
        lt(schema.payApplications.createdAt, row.createdAt),
      ),
    );
  const lessPreviousCertificates = Number(prevTotals?.total ?? 0);

  const totalBilled = Number(row.totalBilled);
  const retentionAmount = Number(row.totalRetention);
  const totalCompletedAndStored = totalBilled; // stored materials baked in
  const totalEarnedLessRetention = totalBilled - retentionAmount;
  const currentPaymentDue = totalEarnedLessRetention - lessPreviousCertificates;
  const balanceToFinish = contractSumToDate - totalCompletedAndStored;

  const g702: AiaG702Data = {
    projectName: row.projectName,
    projectNumber: row.projectNumber,
    ownerName,
    contractorName: row.tenantName,
    architectName,
    applicationNumber,
    periodTo: row.periodEnd,
    invoiceDate: new Date(row.createdAt).toISOString().slice(0, 10),
    contractDate: row.projectStartDate ?? undefined,
    originalContractSum,
    netChangeByCO,
    contractSumToDate,
    totalCompletedAndStored,
    retentionAmount,
    totalEarnedLessRetention,
    lessPreviousCertificates,
    currentPaymentDue,
    balanceToFinish,
  };

  // G703 lines — joined to SoV for descriptions.
  const lineRows = await db
    .select({
      sovLineNumber: schema.sovLines.lineNumber,
      sovDescription: schema.sovLines.description,
      scheduledValue: schema.sovLines.currentAmount,
      previouslyBilled: schema.payApplicationLines.previouslyBilledAmount,
      thisPeriod: schema.payApplicationLines.thisPeriodAmount,
      storedMaterials: schema.payApplicationLines.storedMaterialsAmount,
      retention: schema.payApplicationLines.retentionAmount,
    })
    .from(schema.payApplicationLines)
    .innerJoin(
      schema.sovLines,
      eq(schema.payApplicationLines.sovLineId, schema.sovLines.id),
    )
    .where(eq(schema.payApplicationLines.payApplicationId, row.payAppId))
    .orderBy(asc(schema.sovLines.lineNumber));

  const g703Lines: AiaG703Line[] = lineRows.map((l) => ({
    itemNumber: l.sovLineNumber,
    description: l.sovDescription,
    scheduledValue: Number(l.scheduledValue),
    previouslyBilled: Number(l.previouslyBilled),
    thisPeriod: Number(l.thisPeriod),
    storedMaterials: Number(l.storedMaterials),
    retentionThisPeriod: Number(l.retention),
  }));

  const buffer = await renderToBuffer(
    <Document title={`AIA Pay App #${applicationNumber} — ${row.projectName}`}>
      <AiaG702Page data={g702} />
      <AiaG703Page
        data={{
          applicationNumber,
          periodTo: row.periodEnd,
          projectName: row.projectName,
          projectNumber: row.projectNumber,
          lines: g703Lines,
        }}
      />
    </Document>,
  );
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="aia-pay-app-${applicationNumber}-${row.projectNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
