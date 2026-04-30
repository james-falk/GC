import Link from 'next/link';
import { createProject } from './actions';

// Minimal create form. owner_id and architect_id are nullable in the schema
// and skipped here — they get attached when the Organization-management UI
// lands. Browser-native validation handles the simple cases; the server
// action re-validates with Zod.

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Owner and architect can be added later.
        </p>
      </div>

      <form action={createProject} className="space-y-5">
        <div>
          <label htmlFor="projectNumber" className="block text-sm font-medium text-slate-700">
            Project number
          </label>
          <input
            id="projectNumber"
            name="projectNumber"
            required
            maxLength={64}
            placeholder="e.g. 215"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            placeholder="e.g. Lakeside Office Building"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="originalContractAmount"
            className="block text-sm font-medium text-slate-700"
          >
            Original contract amount
          </label>
          <input
            id="originalContractAmount"
            name="originalContractAmount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            Total contract value with the project owner, before any change orders.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/projects"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
          >
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
