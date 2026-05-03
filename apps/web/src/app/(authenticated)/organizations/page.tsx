import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Organization directory — tenant-scoped. Owner + Architect organizations
// live in the same table, distinguished by `type`. Reusable across projects
// (a public school district can own dozens of projects over time).
//
// See gc-data-model.md § Organization.

const TYPE_STYLES: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-800',
  architect: 'bg-violet-100 text-violet-800',
};

type PageProps = {
  searchParams: Promise<{ type?: 'owner' | 'architect' }>;
};

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const { type } = await searchParams;
  const tenant = await getCurrentTenant();

  const rows = await db
    .select()
    .from(schema.organizations)
    .where(
      and(
        eq(schema.organizations.tenantId, tenant.id),
        type === 'owner' || type === 'architect'
          ? eq(schema.organizations.type, type)
          : undefined,
      ),
    )
    .orderBy(asc(schema.organizations.name));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Project owners and architecture firms. Each entry is reusable —
            when you create a project you pick its owner + architect from
            this directory.
          </p>
        </div>
        <Link
          href="/organizations/new"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
        >
          + Add organization
        </Link>
      </div>

      <div className="flex gap-2">
        <FilterChip href="/organizations" active={!type}>
          All
        </FilterChip>
        <FilterChip href="/organizations?type=owner" active={type === 'owner'}>
          Owners
        </FilterChip>
        <FilterChip
          href="/organizations?type=architect"
          active={type === 'architect'}
        >
          Architects
        </FilterChip>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-700">
            {type ? `No ${type}s yet.` : 'No organizations yet.'}
          </p>
          <Link
            href="/organizations/new"
            className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Add the first one
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Address
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">
                    {o.name}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (TYPE_STYLES[o.type] ?? 'bg-slate-100 text-slate-700')
                      }
                    >
                      {o.type}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {o.contactEmail ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {o.contactPhone ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    {o.address ?? <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        'rounded-full border px-3 py-1 text-xs font-medium transition ' +
        (active
          ? 'border-blue-200 bg-blue-50 text-blue-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
      }
    >
      {children}
    </Link>
  );
}
