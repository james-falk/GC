'use client';

import { useMemo, useState } from 'react';

// Editable pay-app review table. See gc-wireframes-brief.md § Screen 7.
//
// Each row shows the sub-reported percentage alongside an editable
// gc-adjusted percentage (defaults to sub-reported). When the GC lowers a
// value, the row visually flags the adjustment. This period $ recomputes
// from the adjusted percentage.

const RETENTION_PCT = 10;

type Line = {
  id: string;
  description: string;
  currentAmount: number; // dollars
  previouslyBilled: number;
  subReportedPercent: number; // 0–100
};

type Row = Line & {
  gcAdjustedPercent: number;
  note: string;
};

type Props = {
  lines: Line[];
};

export function ReviewTable(props: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    props.lines.map((l) => ({
      ...l,
      gcAdjustedPercent: l.subReportedPercent,
      note: '',
    })),
  );

  const totals = useMemo(() => {
    let subBilled = 0;
    let gcBilled = 0;
    let retention = 0;
    for (const r of rows) {
      const subEarned = (r.currentAmount * r.subReportedPercent) / 100;
      const gcEarned = (r.currentAmount * r.gcAdjustedPercent) / 100;
      subBilled += Math.max(0, subEarned - r.previouslyBilled);
      const thisPeriod = Math.max(0, gcEarned - r.previouslyBilled);
      gcBilled += thisPeriod;
      retention += (thisPeriod * RETENTION_PCT) / 100;
    }
    return { subBilled, gcBilled, retention, net: gcBilled - retention };
  }, [rows]);

  function setRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Description
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Current $
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Previously billed
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Sub %
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                GC adjusted %
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                This period $
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const adjustedDown = r.gcAdjustedPercent < r.subReportedPercent;
              const adjustedUp = r.gcAdjustedPercent > r.subReportedPercent;
              const earned = (r.currentAmount * r.gcAdjustedPercent) / 100;
              const thisPeriod = Math.max(0, earned - r.previouslyBilled);
              return (
                <tr key={r.id} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-2 text-sm">
                    {r.description}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-700">
                    ${formatMoney(r.currentAmount)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-700">
                    ${formatMoney(r.previouslyBilled)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums text-slate-500">
                    {r.subReportedPercent.toFixed(2)}%
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={r.gcAdjustedPercent}
                      onChange={(e) =>
                        setRow(r.id, {
                          gcAdjustedPercent: clamp(Number(e.target.value)),
                        })
                      }
                      className={
                        'block w-24 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 ' +
                        (adjustedDown
                          ? 'border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-amber-500'
                          : adjustedUp
                            ? 'border-blue-300 bg-blue-50 focus:border-blue-500 focus:ring-blue-500'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500')
                      }
                    />
                    {adjustedDown && (
                      <div className="mt-0.5 text-[10px] text-amber-700">
                        Reduced from {r.subReportedPercent.toFixed(2)}%
                      </div>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums font-medium">
                    ${formatMoney(thisPeriod)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <input
                      type="text"
                      value={r.note}
                      onChange={(e) => setRow(r.id, { note: e.target.value })}
                      placeholder={adjustedDown ? 'why reduced…' : 'optional'}
                      className="block w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 text-sm font-medium">
              <td className="px-3 py-2" colSpan={3}>
                Totals
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                sub: ${formatMoney(totals.subBilled)}
              </td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right tabular-nums">
                ${formatMoney(totals.gcBilled)}
              </td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Total this period
          </div>
          <div className="font-semibold tabular-nums">${formatMoney(totals.gcBilled)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Retention (10%)</div>
          <div className="tabular-nums text-slate-700">${formatMoney(totals.retention)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Net to approve
          </div>
          <div className="font-semibold tabular-nums text-blue-700">
            ${formatMoney(totals.net)}
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          disabled
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
        >
          Request revision
        </button>
        <button
          type="button"
          disabled
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white opacity-60"
        >
          Approve sub pay app
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        Approve / request-revision are wired in a later session — adjustments
        compute live so the interaction model is real.
      </p>
    </div>
  );
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
