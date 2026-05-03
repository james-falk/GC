'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  approveSubPayApp,
  requestRevisionSubPayApp,
} from '../../actions';

// Editable pay-app review table. See gc-wireframes-brief.md § Screen 7.
//
// Each row shows the sub-reported percentage alongside an editable
// gc-adjusted percentage (defaults to sub-reported). When the GC lowers
// a value, the row visually flags the adjustment. This period $
// recomputes from the adjusted percentage. Approve sends every row's
// adjusted % + per-row note via `adjusted[<lineId>]` / `note[<lineId>]`
// form fields; the action recomputes thisPeriod $ + retention server-side
// and persists the overrides.

const RETENTION_PCT = 10;

type Line = {
  id: string;
  sovLineId: string;
  description: string;
  currentAmount: number;
  previouslyBilled: number;
  subReportedPercent: number;
  initialGcAdjustedPercent: number;
};

type Row = Line & {
  gcAdjustedPercent: number;
  note: string;
};

type Props = {
  payAppId: string;
  projectId: string;
  lines: Line[];
  editable: boolean;
};

export function ReviewTable(props: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    props.lines.map((l) => ({
      ...l,
      gcAdjustedPercent: l.initialGcAdjustedPercent,
      note: '',
    })),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');

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
                      disabled={!props.editable || pending}
                      onChange={(e) =>
                        setRow(r.id, {
                          gcAdjustedPercent: clamp(Number(e.target.value)),
                        })
                      }
                      className={
                        'block w-24 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 disabled:opacity-60 ' +
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
                </tr>
              );
            })}
          </tbody>
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
          <div className="text-xs uppercase tracking-wide text-slate-500">Net to approve</div>
          <div className="font-semibold tabular-nums text-blue-700">
            ${formatMoney(totals.net)}
          </div>
        </div>
      </div>

      {props.editable && (
        <>
          <div>
            <label htmlFor="reviewComment" className="block text-xs font-medium text-slate-700">
              Comment (required only for revision request)
            </label>
            <textarea
              id="reviewComment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What you'd like the sub to adjust before re-submitting"
              disabled={pending}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="flex gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => handleAction('reject')}
              disabled={pending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Request revision
            </button>
            <button
              type="button"
              onClick={() => handleAction('approve')}
              disabled={pending}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {pending ? 'Working…' : 'Approve sub pay app'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  function handleAction(kind: 'approve' | 'reject') {
    setError(null);
    if (kind === 'reject' && !comment.trim()) {
      setError('Add a comment explaining what needs to change.');
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('payAppId', props.payAppId);
        formData.set('projectId', props.projectId);
        if (kind === 'approve') {
          for (const r of rows) {
            formData.set(`adjusted[${r.id}]`, String(r.gcAdjustedPercent));
            if (r.note.trim()) {
              formData.set(`note[${r.id}]`, r.note.trim());
            }
          }
          await approveSubPayApp(formData);
        } else {
          formData.set('comment', comment.trim());
          await requestRevisionSubPayApp(formData);
        }
        // Action redirects on success.
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Action failed';
        if (message.includes('NEXT_REDIRECT')) return;
        setError(message);
      }
    });
  }
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
