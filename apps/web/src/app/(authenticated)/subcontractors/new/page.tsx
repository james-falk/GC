import Link from 'next/link';
import { createSubcontractor } from '../actions';

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function NewSubcontractorPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add subcontractor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Just the basics for now. Spec sections, COI, W-9 etc. live on the
          subcontract attached to a specific project.
        </p>
      </div>

      <form action={createSubcontractor} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            placeholder="e.g. Brothers & Bricks Masonry"
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
            placeholder="optional"
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
            placeholder="optional"
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
            placeholder="optional"
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
            Add subcontractor
          </button>
        </div>
      </form>
    </div>
  );
}
