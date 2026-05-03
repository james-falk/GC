import Link from 'next/link';
import { createOrganization } from '../actions';

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function NewOrganizationPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add organization</h1>
        <p className="mt-1 text-sm text-slate-600">
          Project owner or architect firm. You&rsquo;ll pick from this list
          when creating a project.
        </p>
      </div>

      <form action={createOrganization} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            placeholder="e.g. Springfield Public Schools"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-slate-700">
            Type
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Pick one&hellip;
            </option>
            <option value="owner">Owner</option>
            <option value="architect">Architect</option>
          </select>
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
            href="/organizations"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Add organization
          </button>
        </div>
      </form>
    </div>
  );
}
