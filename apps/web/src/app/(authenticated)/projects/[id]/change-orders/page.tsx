import Link from 'next/link';

// Change Orders tab — list view. See gc-wireframes-brief.md § Screen 8.
//
// Empty for now (no CO records persisted yet). The "Draft a change order"
// button routes to the create form. Real list lands when CO persistence is
// wired (Day 5).

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectChangeOrdersPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Change Orders</h2>
          <p className="text-sm text-slate-600">
            Draft → architect → owner. Approved COs auto-propagate to the affected
            subcontract and SoV lines.
          </p>
        </div>
        <Link
          href={`/projects/${id}/change-orders/new`}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          + Draft change order
        </Link>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm text-slate-700">No change orders yet.</p>
        <Link
          href={`/projects/${id}/change-orders/new`}
          className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          Draft your first change order
        </Link>
      </div>
    </div>
  );
}
