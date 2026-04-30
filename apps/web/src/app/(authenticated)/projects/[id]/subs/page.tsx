// Subs tab — placeholder. Will become the subcontract list filtered to this
// project. See gc-wireframes-brief.md § Screen 5.

export default function ProjectSubsPage() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
      <p className="text-sm font-medium text-slate-700">Subcontracts</p>
      <p className="mt-1 text-xs text-slate-500">
        Coming next — subcontract list scoped to this project, with billed-to-date
        and remaining-balance columns.
      </p>
    </div>
  );
}
