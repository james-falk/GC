import Link from 'next/link';
import { ApprovalTrail } from './_components/approval-trail';
import { COForm } from './_components/co-form';

// Change Order create. See gc-wireframes-brief.md § Screen 8.
//
// Phase A scope: clickable mock with realistic data inspired by the seed
// fixture (215-CO-001: Brothers & Bricks brick wall extension). Form is
// fully interactive (totals compute live, lines add/remove, sub switching
// updates the line dropdown scope). Save Draft + Submit are wired in a
// later session when CO persistence + state-machine reducers land.

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewChangeOrderPage({ params }: PageProps) {
  const { id: projectId } = await params;

  // Mock subcontract + line options. Real data comes from a join across
  // subcontracts + sov_lines once subcontracts CRUD lands.
  const mock = {
    coNumberSuggestion: 'CO-001',
    subOptions: [
      {
        id: 'sub-215-002',
        contractNumber: '215-002',
        name: 'Brothers & Bricks Masonry',
        lines: [
          { id: 'line-3a', display: '3a — Stone & block delivery' },
          { id: 'line-3b', display: '3b — Masonry labor' },
          { id: 'line-3c', display: '3c — Mortar & grout materials' },
          { id: 'line-3d', display: '3d — Stored materials staging' },
          { id: 'line-3e', display: '3e — Closeout & cleanup' },
        ],
      },
    ],
    initialRows: [
      {
        rowId: 'r-1',
        sovLineId: 'line-3a',
        delta: '8400',
        reason: 'Additional stone for extended wall',
      },
      {
        rowId: 'r-2',
        sovLineId: 'line-3b',
        delta: '24200',
        reason: 'Labor for ~80 ft of additional wall',
      },
      {
        rowId: 'r-3',
        sovLineId: 'line-3c',
        delta: '2100',
        reason: 'Additional mortar',
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Draft change order</h2>
          <p className="text-sm text-slate-600">
            Routes through Principal → Architect → Owner. On owner approval the
            system propagates atomically to the affected subcontract and SoV lines.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/change-orders`}
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <COForm
            coNumberSuggestion={mock.coNumberSuggestion}
            subOptions={mock.subOptions}
            initialRows={mock.initialRows}
          />
        </div>
        <div className="lg:col-span-2">
          <ApprovalTrail />
        </div>
      </div>
    </div>
  );
}
