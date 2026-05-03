import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { and, asc, eq, sum } from 'drizzle-orm';
import { SwornStatement, type SwornStatementData } from '@constructor/pdf';
import { db, schema } from '@constructor/db';

// Sworn-statement PDF download. Resolves the sworn_statements row → its
// owner pay-app → project → tenant + every subcontract on the project,
// summing each sub's billed-to-date and balance from approved sub
// pay-apps for context.
//
// Public route for the same iframe-embedding reason as the AIA route.

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: swornStatementId } = await params;

  const [row] = await db
    .select({
      ssId: schema.swornStatements.id,
      tenantId: schema.swornStatements.tenantId,
      payAppId: schema.swornStatements.payApplicationId,
      periodEnd: schema.payApplications.periodEnd,
      projectId: schema.projects.id,
      projectName: schema.projects.name,
      projectNumber: schema.projects.projectNumber,
      contractorName: schema.tenants.name,
      ownerId: schema.projects.ownerId,
    })
    .from(schema.swornStatements)
    .innerJoin(
      schema.payApplications,
      eq(schema.swornStatements.payApplicationId, schema.payApplications.id),
    )
    .innerJoin(
      schema.projects,
      eq(schema.payApplications.projectId, schema.projects.id),
    )
    .innerJoin(
      schema.tenants,
      eq(schema.swornStatements.tenantId, schema.tenants.id),
    )
    .where(eq(schema.swornStatements.id, swornStatementId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Sworn statement not found' }, { status: 404 });
  }

  // Owner name (optional).
  let ownerName = '—';
  if (row.ownerId) {
    const [owner] = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.id, row.ownerId),
          eq(schema.organizations.tenantId, row.tenantId),
        ),
      )
      .limit(1);
    if (owner) ownerName = owner.name;
  }

  // Subs on the project + each sub's billed-to-date (sum of approved
  // sub pay-app totalBilled for this project + that subcontract).
  const subs = await db
    .select({
      contractId: schema.subcontracts.id,
      subName: schema.subcontractors.name,
      contractAmount: schema.subcontracts.currentAmount,
      // We'll derive trade from spec sections later; for now leave blank.
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.subcontracts.projectId, row.projectId),
        eq(schema.subcontracts.tenantId, row.tenantId),
      ),
    )
    .orderBy(asc(schema.subcontracts.contractNumber));

  // Per-sub paid-this-period: sum totalBilled of pay-apps for THIS period
  // and this subcontract, status >= approved.
  const lines = await Promise.all(
    subs.map(async (s) => {
      const [paidThis] = await db
        .select({ total: sum(schema.payApplications.totalBilled) })
        .from(schema.payApplications)
        .where(
          and(
            eq(schema.payApplications.subcontractId, s.contractId),
            eq(schema.payApplications.tenantId, row.tenantId),
            eq(schema.payApplications.direction, 'sub_to_gc'),
            eq(schema.payApplications.periodEnd, row.periodEnd),
          ),
        );
      const paidThisPeriod = Number(paidThis?.total ?? 0);
      const contractAmount = Number(s.contractAmount);
      // Paid-prior is left at 0 for MVP; richer multi-period rollup is
      // a follow-up.
      return {
        subName: s.subName,
        trade: '',
        contractAmount,
        paidPriorPeriods: 0,
        paidThisPeriod,
        balanceOwed: contractAmount - paidThisPeriod,
      };
    }),
  );

  const totalContractAmount = lines.reduce((acc, l) => acc + l.contractAmount, 0);
  const totalPaidThisPeriod = lines.reduce((acc, l) => acc + l.paidThisPeriod, 0);
  const totalBalanceOwed = lines.reduce((acc, l) => acc + l.balanceOwed, 0);

  const data: SwornStatementData = {
    projectName: row.projectName,
    projectNumber: row.projectNumber,
    contractorName: row.contractorName,
    ownerName,
    periodTo: row.periodEnd,
    contractorPrincipalName: row.contractorName, // best available; user.id-based name later
    totalContractAmount,
    totalPaidPriorPeriods: 0,
    totalPaidThisPeriod,
    totalBalanceOwed,
    lines,
  };

  const buffer = await renderToBuffer(<SwornStatement data={data} />);
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sworn-statement-${row.periodEnd}-${row.projectNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
