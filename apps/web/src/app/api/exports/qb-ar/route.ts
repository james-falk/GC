import { NextResponse } from 'next/server';
import { and, asc, eq, gte, lte, or } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// AR CSV export: every gc_to_owner pay app for the requested period that
// has been billed to the owner (status = sent_to_owner / owner_approved /
// paid), in a QuickBooks Online–importable Invoice CSV shape.
//
// Columns:
//   InvoiceNo, Customer, InvoiceDate, DueDate, Memo, Amount

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

  const rows = await db
    .select({
      payAppId: schema.payApplications.id,
      totalBilled: schema.payApplications.totalBilled,
      totalRetention: schema.payApplications.totalRetention,
      status: schema.payApplications.status,
      periodEnd: schema.payApplications.periodEnd,
      createdAt: schema.payApplications.createdAt,
      approvedAt: schema.payApplications.approvedAt,
      projectNumber: schema.projects.projectNumber,
      ownerId: schema.projects.ownerId,
    })
    .from(schema.payApplications)
    .innerJoin(
      schema.projects,
      eq(schema.payApplications.projectId, schema.projects.id),
    )
    .where(
      and(
        eq(schema.payApplications.tenantId, tenant.id),
        eq(schema.payApplications.direction, 'gc_to_owner'),
        gte(schema.payApplications.periodStart, periodStart),
        lte(schema.payApplications.periodEnd, periodEnd),
        // Any post-generated state — owner has at least seen the bill.
        or(
          eq(schema.payApplications.status, 'sent_to_owner'),
          eq(schema.payApplications.status, 'owner_approved'),
          eq(schema.payApplications.status, 'paid'),
        ),
      ),
    )
    .orderBy(asc(schema.payApplications.periodEnd));

  // Resolve owner organization names for each pay app's project.
  const ownerIds = Array.from(
    new Set(rows.map((r) => r.ownerId).filter((id): id is string => Boolean(id))),
  );
  const owners =
    ownerIds.length > 0
      ? await db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.tenantId, tenant.id))
      : [];
  const ownerNameById = new Map(owners.map((o) => [o.id, o.name]));

  const csv = toCsv(
    ['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Memo', 'Amount'],
    rows.map((r) => {
      const net = (Number(r.totalBilled) - Number(r.totalRetention)).toFixed(2);
      const invoiceDate =
        r.approvedAt instanceof Date
          ? r.approvedAt.toISOString().slice(0, 10)
          : r.createdAt instanceof Date
            ? r.createdAt.toISOString().slice(0, 10)
            : r.periodEnd;
      const due = addDays(invoiceDate, 30);
      const customer = r.ownerId
        ? ownerNameById.get(r.ownerId) ?? 'Unknown owner'
        : '—';
      return [
        `${r.projectNumber}-${r.periodEnd}`,
        customer,
        invoiceDate,
        due,
        `Project ${r.projectNumber} owner pay app — period ending ${r.periodEnd}`,
        net,
      ];
    }),
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="qb-ar-${periodStart}-to-${periodEnd}.csv"`,
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
  for (const row of rows) lines.push(row.map(escape).join(','));
  return lines.join('\n') + '\n';
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
