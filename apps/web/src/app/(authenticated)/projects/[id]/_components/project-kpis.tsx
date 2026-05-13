import Link from 'next/link';
import type { ProjectKpis } from '@/lib/project-kpis';

// Per-project KPI strip. Five tiles with empty-state-safe values: every
// field is always a real number (zero when there's no data), so no
// "—" or "loading" states are needed. Tiles linked into the relevant
// per-project tab so a click drills in.

type Props = {
  kpis: ProjectKpis;
  projectId: string;
};

export function ProjectKpiStrip({ kpis, projectId }: Props) {
  const delta = kpis.approvedCoDeltaDollars;
  const deltaSign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  const deltaTone =
    delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-700' : 'text-slate-400';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile
        label="Contract value"
        value={`$${formatMoney(kpis.currentContractDollars)}`}
        sub={
          delta === 0 ? (
            <span className="text-slate-400">no COs yet</span>
          ) : (
            <span className={deltaTone}>
              {deltaSign}${formatMoney(Math.abs(delta))} via approved COs
            </span>
          )
        }
      />
      <Tile
        label="Billed to date"
        value={`$${formatMoney(kpis.billedToDateDollars)}`}
        sub={
          kpis.currentContractDollars > 0 ? (
            <span className="text-slate-600">
              {kpis.percentBilled.toFixed(1)}% of contract
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )
        }
      >
        {kpis.currentContractDollars > 0 && (
          <ProgressBar percent={kpis.percentBilled} />
        )}
      </Tile>
      <LinkTile
        label="On your desk"
        value={kpis.payAppsAwaitingCount}
        sub={kpis.payAppsAwaitingCount === 1 ? 'pay app' : 'pay apps'}
        href={`/projects/${projectId}/pay-apps`}
        accent={kpis.payAppsAwaitingCount > 0 ? 'amber' : 'slate'}
      />
      <LinkTile
        label="Open COs"
        value={kpis.openCoCount}
        sub={kpis.openCoCount === 1 ? 'in approval chain' : 'in approval chain'}
        href={`/projects/${projectId}/change-orders`}
        accent={kpis.openCoCount > 0 ? 'blue' : 'slate'}
      />
      <LinkTile
        label="Subcontractors"
        value={kpis.subcontractCount}
        sub={kpis.subcontractCount === 1 ? 'sub on this job' : 'subs on this job'}
        href={`/projects/${projectId}/subs`}
        accent="slate"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      <div className="mt-0.5 text-[11px]">{sub}</div>
      {children}
    </div>
  );
}

function LinkTile({
  label,
  value,
  sub,
  href,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  href: string;
  accent: 'slate' | 'amber' | 'blue' | 'emerald';
}) {
  const accentClasses: Record<string, string> = {
    slate: 'bg-white border-slate-200',
    amber: 'bg-amber-50 border-amber-200',
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
  };
  return (
    <Link
      href={href}
      className={
        'block rounded-lg border px-4 py-3 transition hover:shadow-sm ' +
        accentClasses[accent]
      }
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-600">{sub}</div>
    </Link>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full bg-blue-600 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
