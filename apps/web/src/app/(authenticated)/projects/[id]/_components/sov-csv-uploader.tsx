'use client';

import { useRef, useState, useTransition } from 'react';
import { importSovCsv } from '../actions';

// SoV CSV import. File picker → reads as text → posts to importSovCsv.
// Validation errors come back as a multi-line message (the action throws
// with bullet-listed problems); we render them in a red box.
//
// CSV schema reminder is shown in a small details/summary so the form
// stays compact when not in use.

type Props = {
  projectId: string;
};

const TEMPLATE = `line_number,description,parent_line_number,contract_number,contract_amount
1,Site work,,,40000.00
2,General conditions,,,80000.00
3,Masonry,,LE-2-002,0.00
3a,Brick,3,LE-2-002,280000.00
3b,Block,3,LE-2-002,140000.00
4,Electrical,,LE-2-003,185000.00
5,Mechanical,,LE-2-004,310000.00
`;

export function SovCsvUploader({ projectId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sov-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setError(null);

    if (file.size > 1_000_000) {
      setError('CSV is larger than 1 MB — split it or trim unused columns.');
      return;
    }

    startTransition(async () => {
      try {
        const text = await file.text();
        const fd = new FormData();
        fd.set('projectId', projectId);
        fd.set('csv', text);
        await importSovCsv(fd);
        // Server revalidates the project page; the new lines will appear
        // when this transition resolves and the page re-renders.
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Import failed';
        setError(msg);
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Import SoV from CSV</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Bulk-add lines from a spreadsheet. Add subcontracts first if you
            want to link them by contract number.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Download template
          </button>
          <button
            type="button"
            onClick={pick}
            disabled={pending}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
          >
            {pending ? 'Importing…' : 'Choose CSV'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFileChange}
      />

      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
          Schema
        </summary>
        <div className="mt-2 space-y-1.5 rounded border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed">
          <div>
            <span className="text-emerald-700">line_number</span> — required, e.g.{' '}
            <span className="text-slate-900">"1"</span>,{' '}
            <span className="text-slate-900">"3a"</span>
          </div>
          <div>
            <span className="text-emerald-700">description</span> — required
          </div>
          <div>
            <span className="text-emerald-700">contract_amount</span> — required,
            e.g. <span className="text-slate-900">280000.00</span>
          </div>
          <div>
            <span className="text-slate-500">parent_line_number</span> — optional,
            references another line in the same CSV. One level of nesting only.
          </div>
          <div>
            <span className="text-slate-500">contract_number</span> — optional,
            references an existing subcontract on this project (case-sensitive).
          </div>
        </div>
      </details>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <div className="font-medium">Import failed</div>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px]">{error}</pre>
        </div>
      )}
    </div>
  );
}
