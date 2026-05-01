import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { AiaG702, type AiaG702Data } from '@constructor/pdf';

// PDF download endpoint for an AIA G702 pay app cover sheet.
// Public-ish — gated only by the [payAppId] segment for now since we don't
// yet persist pay-app records. Once pay apps land in the DB, this should
// auth via getCurrentTenant() and look up the pay-app row, populating the
// AiaG702Data from real fields.
//
// For now: returns a PDF generated from mock data shaped on the seed
// fixture (project 215, March 2026 owner-direction pay app).

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ payAppId: string }> },
): Promise<Response> {
  // Acknowledge the segment so 'unused' doesn't fire when this route is
  // wired to real data; the param itself isn't used in the mock yet.
  await params;

  const data = MOCK_PAY_APP_DATA;

  const buffer = await renderToBuffer(<AiaG702 data={data} />);
  // renderToBuffer returns a Node Buffer; wrap as Uint8Array so it satisfies
  // the standard BodyInit shape NextResponse expects.
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="aia-g702-pay-app-${data.applicationNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

// Mock pay-app data shaped on the seed fixture for project 215. Numbers
// derived from gc-seed-data.md: original $1,872,000 contract; CO 215-CO-001
// adds $34,700; March 2026 sub work cumulatively earned per the seed.
const MOCK_PAY_APP_DATA: AiaG702Data = {
  projectName: 'Lincoln Elementary Renovation Phase 2',
  projectNumber: '215',
  ownerName: 'Springfield Public Schools',
  contractorName: 'Acme Construction Group',
  architectName: 'Northbridge Architecture & Design',
  applicationNumber: '03',
  periodTo: '2026-03-31',
  invoiceDate: '2026-04-02',
  contractDate: '2026-01-15',
  originalContractSum: 1_872_000.0,
  netChangeByCO: 34_700.0,
  contractSumToDate: 1_906_700.0,
  totalCompletedAndStored: 296_870.74,
  retentionAmount: 29_687.07,
  totalEarnedLessRetention: 267_183.67,
  lessPreviousCertificates: 0,
  currentPaymentDue: 267_183.67,
  balanceToFinish: 1_639_516.33,
};
