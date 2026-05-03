import { NextResponse } from 'next/server';
import { and, asc, desc, eq, gte, lte, or } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// AP CSV export: every approved sub_to_gc pay app for the requested
// period, in a QuickBooks Online–importable CSV shape.
//
// Each row = one approved sub pay-app = one bill payable to that sub.
// Columns chosen to match QBO's "Bill" CSV import expectation:
//   BillNo, Vendor, BillDate, DueDate, Memo, Amount
//
// Period filter via ?periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD
// (both required). Tenant-scoped via Clerk session.

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const tenant = await getCurrentTenant();
  const url = new URL(req.url);
  const periodStart = url.searchParams.get('periodStart');
  const periodEnd = url.searchParams.get('periodEnd');

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      { error: 'periodStart and periodEnd query params are required (YYYY-MM-DD)' },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return NextResponse.json({ error: 'dates must be YYYY-MM-DD' }, { status: 400 });
  }

  // approved + included_in_owner_pay_app both count as billable for AP.
  const rows = await db
    .select({
      payAppId: schema.payApplications.id,
      totalBilled: schema.payApplications.totalBilled,
      totalRetention: schema.payApplications.totalRetention,
      approvedAt: schema.payApplications.approvedAt,
      periodEnd: schema.payApplications.periodEnd,
      vendorName: schema.subcontractors.name,
      contractNumber: schema.subcontracts.contractNumber,
      projectNumber: schema.projects.projectNumber,
    })
    .from(schema.payApplications)
    .innerJoin(
      schema.subcontracts,
      eq(schema.payApplications.subcontractId, schema.subcontracts.id),
    )
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .innerJoin(
      schema.projects,
      eq(schema.payApplications.projectId, schema.projects.id),
    )
    .where(
      and(
        eq(schema.payApplications.tenantId, tenant.id),
        eq(schema.payApplications.direction, 'sub_to_gc'),
        gte(schema.payApplications.periodStart, periodStart),
        lte(schema.payApplications.periodEnd, periodEnd),
        or(
          eq(schema.payApplications.status, 'approved'),
          eq(schema.payApplications.status, 'included_in_owner_pay_app'),
          eq(schema.payApplications.status, 'paid'),
        ),
      ),
    )
    .orderBy(asc(schema.subcontractors.name), desc(schema.payApplications.periodEnd));

  const csv = toCsv(
    ['BillNo', 'Vendor', 'BillDate', 'DueDate', 'Memo', 'Amount'],
    rows.map((r) => {
      // Net = totalBilled - totalRetention. Retention is held back from the
      // contractor and tracked separately; the amount actually owed this
      // period is net.
      const net = (
        Number(r.totalBilled) - Number(r.totalRetention)
      ).toFixed(2);
      const billDate =
        r.approvedAt instanceof Date
          ? r.approvedAt.toISOString().slice(0, 10)
          : r.periodEnd;
      // 30-day terms is a common default; real implementation reads from
      // subcontractor settings.
      const due = addDays(billDate, 30);
      return [
        `${r.contractNumber}-${r.periodEnd}`,
        r.vendorName,
        billDate,
        due,
        `Project ${r.projectNumber} pay app — period ending ${r.periodEnd}`,
        net,
      ];
    }),
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="qb-ap-${periodStart}-to-${periodEnd}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number): string => {
    const s = String(value);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n') + '\n';
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
