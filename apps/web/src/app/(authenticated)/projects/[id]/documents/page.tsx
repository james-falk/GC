// Documents tab — Document Vault. See gc-wireframes-brief.md § Screen 5
// (Documents subtab on Subcontract Detail) and the data-model entity
// DocumentAttachment (polymorphic). Project-scoped here; per-subcontract
// filtering lands when subcontracts CRUD does.
//
// Phase C scope: list + non-functional upload zone, mocked entries shaped
// on a typical project doc set. Real R2 upload + signed URL retrieval is
// a follow-up — needs Cloudflare R2 wiring + presigned-URL flow.

const TYPE_STYLES: Record<string, string> = {
  Contract: 'bg-blue-100 text-blue-800',
  COI: 'bg-violet-100 text-violet-800',
  'W-9': 'bg-slate-200 text-slate-800',
  'Pay app': 'bg-emerald-100 text-emerald-800',
  'Sworn statement': 'bg-amber-100 text-amber-800',
  RFI: 'bg-orange-100 text-orange-800',
  Other: 'bg-slate-100 text-slate-700',
};

type Doc = {
  id: string;
  filename: string;
  type: keyof typeof TYPE_STYLES;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
};

const MOCK_DOCS: Doc[] = [
  {
    id: 'doc-1',
    filename: '215-002 — Brothers & Bricks signed contract.pdf',
    type: 'Contract',
    size: '1.2 MB',
    uploadedBy: 'Lena Torres',
    uploadedAt: '3 weeks ago',
  },
  {
    id: 'doc-2',
    filename: 'Brothers & Bricks — COI 2026.pdf',
    type: 'COI',
    size: '340 KB',
    uploadedBy: 'Riley Kim',
    uploadedAt: '2 weeks ago',
  },
  {
    id: 'doc-3',
    filename: 'Brothers & Bricks — W-9.pdf',
    type: 'W-9',
    size: '128 KB',
    uploadedBy: 'Riley Kim',
    uploadedAt: '4 weeks ago',
  },
  {
    id: 'doc-4',
    filename: '215 — March 2026 owner pay app G702 (signed).pdf',
    type: 'Pay app',
    size: '512 KB',
    uploadedBy: 'Sam Rivera',
    uploadedAt: 'today',
  },
  {
    id: 'doc-5',
    filename: '215 — March 2026 sworn statement (signed + notarized).pdf',
    type: 'Sworn statement',
    size: '624 KB',
    uploadedBy: 'Sam Rivera',
    uploadedAt: 'today',
  },
  {
    id: 'doc-6',
    filename: 'RFI 014 — south entrance brick wall extension.pdf',
    type: 'RFI',
    size: '218 KB',
    uploadedBy: 'Jordan Wells',
    uploadedAt: '1 week ago',
  },
  {
    id: 'doc-7',
    filename: 'Apex Electric — signed contract.pdf',
    type: 'Contract',
    size: '880 KB',
    uploadedBy: 'Lena Torres',
    uploadedAt: '3 weeks ago',
  },
  {
    id: 'doc-8',
    filename: 'Apex Electric — COI 2026.pdf',
    type: 'COI',
    size: '298 KB',
    uploadedBy: 'Riley Kim',
    uploadedAt: '2 weeks ago',
  },
];

const TYPE_FILTERS: Array<keyof typeof TYPE_STYLES | 'All'> = [
  'All',
  'Contract',
  'COI',
  'W-9',
  'Pay app',
  'Sworn statement',
  'RFI',
  'Other',
];

export default function ProjectDocumentsPage() {
  const docs = MOCK_DOCS;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-slate-600">
            All files attached to this project. Anything signed, notarized, or
            sent to an external party lives here as the system of record.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white opacity-60"
        >
          + Upload
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f, idx) => (
          <span
            key={f}
            className={
              'rounded-full border px-3 py-1 text-xs font-medium ' +
              (idx === 0
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-700')
            }
          >
            {f}
          </span>
        ))}
      </div>

      {/* Drag-drop zone (visual only) */}
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">
          Drag files here, or click <span className="text-blue-700">Upload</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          PDF, JPG, PNG up to 25 MB. Real upload to R2 lands in a follow-up
          session — for now this is a mock.
        </p>
      </div>

      {/* Document table */}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Type
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Filename
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Size
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Uploaded by
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Uploaded
              </th>
              <th className="border-b border-slate-200 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="border-b border-slate-100 px-4 py-3 text-sm">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (TYPE_STYLES[d.type] ?? TYPE_STYLES.Other)
                    }
                  >
                    {d.type}
                  </span>
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
                  {d.filename}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-right text-sm tabular-nums text-slate-600">
                  {d.size}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                  {d.uploadedBy}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
                  {d.uploadedAt}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled
                    className="text-xs font-medium text-slate-400"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Mocked entries — real R2 storage + signed-URL downloads land in a
        follow-up. The polymorphic <code>document_attachments</code> schema
        is already in place; just needs the upload pipeline.
      </p>
    </div>
  );
}
