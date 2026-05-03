// Exports — month-end CSV downloads for QuickBooks Online import.
// AP CSV = sub pay-apps approved in the period (vendors/bills payable).
// AR CSV = owner pay-apps billed in the period (customers/invoices receivable).
//
// Period is picked client-side via two date inputs; the download links
// hit the /api/exports/qb-{ap,ar} routes with the period as query params.
//
// This page is a client component because it needs to compose the URL
// query string client-side from the picker state.

'use client';

import { useState } from 'react';

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function ExportsPage() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const ready =
    /^\d{4}-\d{2}-\d{2}$/.test(periodStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) &&
    periodStart <= periodEnd;

  const apUrl = ready
    ? `/api/exports/qb-ap?periodStart=${periodStart}&periodEnd=${periodEnd}`
    : '';
  const arUrl = ready
    ? `/api/exports/qb-ar?periodStart=${periodStart}&periodEnd=${periodEnd}`
    : '';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Month-end CSV downloads in a QuickBooks Online–importable shape.
          AP = sub pay-apps approved in the period; AR = owner pay-apps
          billed in the period. Net of retention in both.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Period</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="periodStart" className="block text-xs font-medium text-slate-700">
              Period start
            </label>
            <input
              id="periodStart"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="periodEnd" className="block text-xs font-medium text-slate-700">
              Period end
            </label>
            <input
              id="periodEnd"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            AP CSV (sub bills)
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Approved sub pay-apps for the period, formatted as QBO Bills:
            BillNo, Vendor, BillDate, DueDate, Memo, Amount.
          </p>
          {ready ? (
            <a
              href={apUrl}
              download
              className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Download AP CSV
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white opacity-50"
            >
              Pick a period first
            </button>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            AR CSV (owner invoices)
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Owner pay-apps billed in the period, formatted as QBO Invoices:
            InvoiceNo, Customer, InvoiceDate, DueDate, Memo, Amount.
          </p>
          {ready ? (
            <a
              href={arUrl}
              download
              className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Download AR CSV
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white opacity-50"
            >
              Pick a period first
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Both CSVs are tenant-scoped + period-filtered; subset by status
        (AP: approved/included/paid sub pay-apps; AR: sent_to_owner/
        owner_approved/paid owner pay-apps). Net amounts are total billed
        minus retention.
      </p>
    </div>
  );
}
