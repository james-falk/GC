import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { updateSubcontractor } from '../../actions';

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSubcontractorPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await getCurrentTenant();

  const [sub] = await db
    .select()
    .from(schema.subcontractors)
    .where(
      and(
        eq(schema.subcontractors.id, id),
        eq(schema.subcontractors.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!sub) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit subcontractor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Updates the directory entry. Existing subcontracts referencing this
          subcontractor are unaffected; new pay-app emails go to the address
          below.
        </p>
      </div>

      <form action={updateSubcontractor} className="space-y-5">
        <input type="hidden" name="subcontractorId" value={sub.id} />

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={sub.name}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-slate-700">
            Contact email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            maxLength={200}
            defaultValue={sub.contactEmail ?? ''}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contactPhone" className="block text-sm font-medium text-slate-700">
            Contact phone
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            maxLength={64}
            defaultValue={sub.contactPhone ?? ''}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-slate-700">
            Address
          </label>
          <input
            id="address"
            name="address"
            maxLength={500}
            defaultValue={sub.address ?? ''}
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/subcontractors"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
