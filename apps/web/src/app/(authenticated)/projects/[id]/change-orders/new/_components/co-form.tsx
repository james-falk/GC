'use client';

import { useMemo, useState } from 'react';

// Change Order form. See gc-wireframes-brief.md § Screen 8.
//
// Phase A scope: all fields render and interact, totals compute live, but
// Save Draft + Submit are wired in a later session. The lines table supports
// add + remove + edit; line dropdown is scoped to the chosen subcontract.

type LineOption = {
  id: string;
  display: string; // e.g. "3a — Stone & block delivery"
};

type SubOption = {
  id: string;
  name: string;
  contractNumber: string;
  lines: LineOption[];
};

type Row = {
  rowId: string;
  sovLineId: string;
  delta: string; // raw input string so user can type "-1234.56"
  reason: string;
};

type Props = {
  coNumberSuggestion: string;
  subOptions: SubOption[];
  initialRows: Row[];
};

export function COForm(props: Props) {
  const [coNumber, setCoNumber] = useState(props.coNumberSuggestion);
  const [subId, setSubId] = useState(props.subOptions[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [rows, setRows] = useState<Row[]>(props.initialRows);

  const activeSub = props.subOptions.find((s) => s.id === subId);
  const lineOptions = activeSub?.lines ?? [];

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.delta) || 0), 0),
    [rows],
  );

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        rowId: crypto.randomUUID(),
        sovLineId: lineOptions[0]?.id ?? '',
        delta: '',
        reason: '',
      },
    ]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  function updateRow(rowId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  return (
    <form className="space-y-6">
      {/* Header row: CO number + total */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="coNumber" className="block text-xs font-medium text-slate-700">
            CO number
          </label>
          <input
            id="coNumber"
            value={coNumber}
            onChange={(e) => setCoNumber(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total impact</div>
          <div
            className={
              'mt-1 text-xl font-semibold tabular-nums ' +
              (total === 0
                ? 'text-slate-400'
                : total > 0
                  ? 'text-emerald-700'
                  : 'text-red-700')
            }
          >
            {total === 0 ? '$0.00' : `${total > 0 ? '+' : '-'}$${formatMoney(Math.abs(total))}`}
          </div>
        </div>
      </div>

      {/* Affected subcontract */}
      <div>
        <label htmlFor="subId" className="block text-xs font-medium text-slate-700">
          Affected subcontract
        </label>
        <select
          id="subId"
          value={subId}
          onChange={(e) => {
            setSubId(e.target.value);
            // Clear line selections when switching sub since the line scope changes.
            setRows((prev) => prev.map((r) => ({ ...r, sovLineId: '' })));
          }}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {props.subOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.contractNumber} — {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-xs font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Brick wall extension at south entrance — owner-requested scope addition"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Line items</h3>
          <button
            type="button"
            onClick={addRow}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            + Add line
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            No line items yet. Add the first one.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    SoV line
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Add / Deduct $
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Reason
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowId}>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <select
                        value={row.sovLineId}
                        onChange={(e) => updateRow(row.rowId, { sovLineId: e.target.value })}
                        className="block w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {lineOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.display}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={row.delta}
                        onChange={(e) => updateRow(row.rowId, { delta: e.target.value })}
                        placeholder="0.00"
                        className="block w-full rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <input
                        type="text"
                        value={row.reason}
                        onChange={(e) => updateRow(row.rowId, { reason: e.target.value })}
                        placeholder="why this change"
                        className="block w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowId)}
                        className="text-xs text-slate-400 transition hover:text-red-600"
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Justification */}
      <div>
        <label htmlFor="justification" className="block text-xs font-medium text-slate-700">
          Justification
        </label>
        <textarea
          id="justification"
          rows={3}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Why this CO is needed, who requested it, references to RFI/ASI numbers, etc."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          disabled
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white opacity-60"
        >
          Submit for approval
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        Save draft and submit are wired in a later session — for now this is a
        clickable mock so the shape is visible.
      </p>
    </form>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
