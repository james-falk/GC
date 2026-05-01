import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { SwornStatement, type SwornStatementData } from '@constructor/pdf';

// Sworn statement PDF download endpoint. Mirrors the AIA G702 route shape.
// Phase A scope: returns mock data shaped on the seed fixture (project 215,
// March 2026 sub pay-app values become "paid this period" amounts).

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await params;

  const data = MOCK_SWORN_STATEMENT;

  const buffer = await renderToBuffer(<SwornStatement data={data} />);
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sworn-statement-${data.periodTo}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

// Numbers shaped on gc-seed-data.md. The "paid this period" column reflects
// the in-flight Brothers & Bricks March 2026 sub pay app from the seed
// (their five SoV lines: 3a/3b/3c/3d/3e, billed at the seeded percentages).
// Other subs show their contract amounts with $0 paid (haven't billed yet
// in this seeded scenario).
const MOCK_SWORN_STATEMENT: SwornStatementData = {
  projectName: 'Lincoln Elementary Renovation Phase 2',
  projectNumber: '215',
  contractorName: 'Acme Construction Group',
  ownerName: 'Springfield Public Schools',
  periodTo: '2026-03-31',
  contractorPrincipalName: 'Sam Rivera',
  totalContractAmount: 1_486_272.0,
  totalPaidPriorPeriods: 0,
  totalPaidThisPeriod: 268_313.3,
  totalBalanceOwed: 1_217_958.7,
  lines: [
    {
      subName: 'Cascade Demo & Site Services',
      trade: 'Demolition / site work',
      contractAmount: 19_000.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 19_000.0,
    },
    {
      subName: 'Brothers & Bricks Masonry',
      trade: 'Masonry',
      contractAmount: 576_622.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 268_313.3,
      balanceOwed: 308_308.7,
    },
    {
      subName: 'Apex Electric Co.',
      trade: 'Electrical',
      contractAmount: 182_400.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 182_400.0,
    },
    {
      subName: 'Northern Mechanical Systems',
      trade: 'HVAC',
      contractAmount: 241_000.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 241_000.0,
    },
    {
      subName: 'Riverside Plumbing',
      trade: 'Plumbing',
      contractAmount: 97_500.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 97_500.0,
    },
    {
      subName: 'Stoneline Drywall & Paint',
      trade: 'Drywall, paint',
      contractAmount: 128_800.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 128_800.0,
    },
    {
      subName: 'Coastal Roofing',
      trade: 'Roofing',
      contractAmount: 156_750.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 156_750.0,
    },
    {
      subName: 'Premier Flooring Solutions',
      trade: 'Flooring',
      contractAmount: 84_200.0,
      paidPriorPeriods: 0,
      paidThisPeriod: 0,
      balanceOwed: 84_200.0,
    },
  ],
};
