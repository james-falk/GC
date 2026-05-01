// Subs tab — subcontract list scoped to this project. See gc-wireframes-brief.md
// § Screen 5 (list view).
//
// Phase D dogfooding scope: mocked list shaped on the seed fixture so the
// Spartan demo isn't an empty placeholder when they click in. Real list
// (with subcontract CRUD) lands when subcontracts persistence is wired.

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
};

type Sub = {
  id: string;
  name: string;
  contractNumber: string;
  trade: string;
  originalAmount: number;
  cosAmount: number;
  currentAmount: number;
  billedToDate: number;
  status: 'draft' | 'active' | 'closed';
};

const MOCK_SUBS: Sub[] = [
  {
    id: 'sub-1',
    name: 'Cascade Demo & Site Services',
    contractNumber: '215-001',
    trade: 'Demolition / site work',
    originalAmount: 19_000,
    cosAmount: 0,
    currentAmount: 19_000,
    billedToDate: 0,
    status: 'active',
  },
  {
    id: 'sub-2',
    name: 'Brothers & Bricks Masonry',
    contractNumber: '215-002',
    trade: 'Masonry',
    originalAmount: 576_622,
    cosAmount: 34_700,
    currentAmount: 611_322,
    billedToDate: 268_313.3,
    status: 'active',
  },
  {
    id: 'sub-3',
    name: 'Apex Electric Co.',
    contractNumber: '215-003',
    trade: 'Electrical',
    originalAmount: 182_400,
    cosAmount: 0,
    currentAmount: 182_400,
    billedToDate: 0,
    status: 'active',
  },
  {
    id: 'sub-4',
    name: 'Northern Mechanical Systems',
    contractNumber: '215-004',
    trade: 'HVAC',
    originalAmount: 241_000,
    cosAmount: 0,
    currentAmount: 241_000,
    billedToDate: 0,
    status: 'active',
  },
  {
    id: 'sub-5',
    name: 'Riverside Plumbing',
    contractNumber: '215-005',
    trade: 'Plumbing',
    originalAmount: 97_500,
    cosAmount: 0,
    currentAmount: 97_500,
    billedToDate: 0,
    status: 'active',
  },
  {
    id: 'sub-6',
    name: 'Stoneline Drywall & Paint',
    contractNumber: '215-006',
    trade: 'Drywall, paint',
    originalAmount: 128_800,
    cosAmount: 0,
    currentAmount: 128_800,
    billedToDate: 0,
    status: 'draft',
  },
  {
    id: 'sub-7',
    name: 'Coastal Roofing',
    contractNumber: '215-007',
    trade: 'Roofing',
    originalAmount: 156_750,
    cosAmount: 0,
    currentAmount: 156_750,
    billedToDate: 0,
    status: 'active',
  },
  {
    id: 'sub-8',
    name: 'Premier Flooring Solutions',
    contractNumber: '215-008',
    trade: 'Flooring',
    originalAmount: 84_200,
    cosAmount: 0,
    currentAmount: 84_200,
    billedToDate: 0,
    status: 'draft',
  },
];

export default function ProjectSubsPage() {
  const subs = MOCK_SUBS;
  const totals = subs.reduce(
    (acc, s) => ({
      original: acc.original + s.originalAmount,
      cos: acc.cos + s.cosAmount,
      current: acc.current + s.currentAmount,
      billed: acc.billed + s.billedToDate,
    }),
    { original: 0, cos: 0, current: 0, billed: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Subcontracts</h2>
          <p className="text-sm text-slate-600">
            All subs on this project. Billed-to-date reflects approved sub
            pay-app totals; balance = current contract minus billed.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white opacity-60"
        >
          + Add subcontract
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                Subcontractor
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                Contract #
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Original $
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                COs $
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Current $
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Billed to date
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Balance
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const balance = s.currentAmount - s.billedToDate;
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-2.5">
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.trade}</div>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">
                    {s.contractNumber}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                    ${formatMoney(s.originalAmount)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">
                    {s.cosAmount === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="text-emerald-700">
                        +${formatMoney(s.cosAmount)}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums font-medium">
                    ${formatMoney(s.currentAmount)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                    ${formatMoney(s.billedToDate)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                    ${formatMoney(balance)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (STATUS_STYLES[s.status] ?? 'bg-slate-100 text-slate-700')
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 text-sm font-medium">
              <td className="px-3 py-2.5" colSpan={2}>
                Totals
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                ${formatMoney(totals.original)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                +${formatMoney(totals.cos)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                ${formatMoney(totals.current)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                ${formatMoney(totals.billed)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                ${formatMoney(totals.current - totals.billed)}
              </td>
              <td className="px-3 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Mocked entries — real subcontract list lands when subcontracts CRUD
        is wired (and persistence flows down through CO + pay-app + sworn
        statement).
      </p>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
