'use client';

import { useState } from 'react';

// External approval form — magic-link consumer side. See gc-wireframes-brief.md
// § Screen 11.
//
// Phase B scope: client-side state transitions for the demo. Real flow on
// the next pass: hash the URL token, look up magic_links row, verify not
// consumed/expired, transition the parent entity (CO / pay app / sworn
// statement) via the appropriate state-machine reducer, mark magic-link
// consumed, insert approval_event.

type DocLabel = string;
type DocSubtitle = string;

type Props = {
  documentLabel: DocLabel;
  documentSubtitle: DocSubtitle;
};

type Action = 'approved' | 'rejected';

export function ApprovalForm({ documentLabel, documentSubtitle }: Props) {
  const [action, setAction] = useState<Action | null>(null);
  const [comment, setComment] = useState('');

  if (action === 'approved') {
    return (
      <SuccessCard
        accent="emerald"
        title="Thank you."
        body={`The contractor will be notified that you approved the ${documentLabel}.`}
      />
    );
  }

  if (action === 'rejected') {
    return (
      <SuccessCard
        accent="amber"
        title="Changes requested."
        body={`The contractor will be notified with your comment and will resubmit a revised ${documentLabel}.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="comment" className="block text-xs font-medium text-slate-700">
          Comments (optional for approval, required to request changes)
        </label>
        <textarea
          id="comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add any notes or, if requesting changes, what you'd like adjusted."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-2 sm:flex sm:gap-3 sm:space-y-0">
        <button
          type="button"
          onClick={() => setAction('approved')}
          className="block w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:flex-1"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => {
            if (!comment.trim()) {
              alert('Please add a comment explaining what changes you need.');
              return;
            }
            setAction('rejected');
          }}
          className="block w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-1"
        >
          Request changes
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        This link is single-use and expires automatically. {documentSubtitle}
      </p>
    </div>
  );
}

function SuccessCard({
  accent,
  title,
  body,
}: {
  accent: 'emerald' | 'amber';
  title: string;
  body: string;
}) {
  const accentClasses =
    accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div className={`rounded-lg border ${accentClasses} px-5 py-6 text-center`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm">{body}</p>
      <p className="mt-3 text-[11px] opacity-70">
        You can close this tab — no further action needed.
      </p>
    </div>
  );
}
