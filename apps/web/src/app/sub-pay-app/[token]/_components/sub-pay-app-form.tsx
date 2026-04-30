'use client';

import { useMemo, useState } from 'react';

// Mobile-first sub pay-app form. See gc-wireframes-brief.md § Screen 6.
//
// Phase C scope: clickable mock. No magic-link verification, no submission.
// Wires the live computed fields (this period $, retention $, net to invoice)
// so the interaction model is real. Persistence + magic-link consumption land
// when subcontract data is in the DB and we have a real pay_application row
// to bind the form to.

const RETENTION_PCT = 10;

type Line = {
  id: string;
  description: string;
  currentAmount: number; // dollars
  previouslyBilled: number;
};

type Props = {
  projectName: string;
  contractor: string;
  period: string; // human-readable, e.g. "March 1–31, 2026"
  contractAmount: number;
  lines: Line[];
};

export function SubPayAppForm(props: Props) {
  const [percents, setPercents] = useState<Record<string, number>>(
    () => Object.fromEntries(props.lines.map((l) => [l.id, 0])),
  );
  const [storedMaterials, setStoredMaterials] = useState<Record<string, number>>(
    () => Object.fromEntries(props.lines.map((l) => [l.id, 0])),
  );

  const computed = useMemo(() => {
    let totalThisPeriod = 0;
    let totalRetention = 0;
    const perLine = props.lines.map((l) => {
      const pct = percents[l.id] ?? 0;
      const stored = storedMaterials[l.id] ?? 0;
      const earnedToDate = (l.currentAmount * pct) / 100;
      const thisPeriod = Math.max(0, earnedToDate - l.previouslyBilled);
      const retention = (thisPeriod * RETENTION_PCT) / 100;
      const overCeiling = earnedToDate > l.currentAmount;
      totalThisPeriod += thisPeriod;
      totalRetention += retention;
      return { id: l.id, thisPeriod, retention, stored, overCeiling };
    });
    return {
      perLine,
      totalThisPeriod,
      totalRetention,
      netToInvoice: totalThisPeriod - totalRetention,
    };
  }, [props.lines, percents, storedMaterials]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900">constructor</div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">{props.projectName}</h1>
        <div className="mt-1 text-sm text-slate-600">
          {props.contractor} — period {props.period}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Contract amount: ${formatMoney(props.contractAmount)}
        </div>
      </header>

      {/* Status banner — draft (default state) */}
      <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Draft — fill in this period's percentages, then submit for review.
      </div>

      {/* Line items */}
      <div className="space-y-4">
        {props.lines.map((line) => {
          const computedLine = computed.perLine.find((c) => c.id === line.id);
          if (!computedLine) return null;
          const pct = percents[line.id] ?? 0;
          const stored = storedMaterials[line.id] ?? 0;
          return (
            <div
              key={line.id}
              className={
                'rounded-lg border bg-white p-4 ' +
                (computedLine.overCeiling
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200')
              }
            >
              <div className="text-sm font-medium text-slate-900">{line.description}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <div>
                  <dt className="inline text-slate-500">Contract: </dt>
                  <dd className="inline tabular-nums">${formatMoney(line.currentAmount)}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Previously billed: </dt>
                  <dd className="inline tabular-nums">${formatMoney(line.previouslyBilled)}</dd>
                </div>
              </dl>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`pct-${line.id}`}
                    className="block text-xs font-medium text-slate-700"
                  >
                    This period %
                  </label>
                  <input
                    id={`pct-${line.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={pct}
                    onChange={(e) =>
                      setPercents((prev) => ({
                        ...prev,
                        [line.id]: clampPercent(Number(e.target.value)),
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`stored-${line.id}`}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Stored materials $
                  </label>
                  <input
                    id={`stored-${line.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={stored || ''}
                    placeholder="0.00"
                    onChange={(e) =>
                      setStoredMaterials((prev) => ({
                        ...prev,
                        [line.id]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">This period $</dt>
                  <dd className="font-semibold tabular-nums">
                    ${formatMoney(computedLine.thisPeriod)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Retention $</dt>
                  <dd className="tabular-nums text-slate-700">
                    ${formatMoney(computedLine.retention)}
                  </dd>
                </div>
              </dl>

              {computedLine.overCeiling && (
                <p className="mt-3 text-xs font-medium text-red-700">
                  This exceeds your contract ceiling. Submit a change order with
                  the GC if additional work is approved.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Spacer so sticky footer doesn't cover content */}
      <div className="h-32" />

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3 shadow-lg">
        <div className="mx-auto max-w-2xl">
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-slate-500">Total this period</dt>
              <dd className="text-sm font-semibold tabular-nums">
                ${formatMoney(computed.totalThisPeriod)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Retention</dt>
              <dd className="text-sm tabular-nums text-slate-700">
                ${formatMoney(computed.totalRetention)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Net to invoice</dt>
              <dd className="text-base font-semibold tabular-nums text-blue-700">
                ${formatMoney(computed.netToInvoice)}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled
              className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled
              className="flex-1 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white opacity-60"
            >
              Submit for review
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Save and submit are wired in a later session.
          </p>
        </div>
      </div>
    </div>
  );
}

function clampPercent(n: number): number {
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
