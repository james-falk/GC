'use client';

import { useState, useTransition } from 'react';
import { approveViaMagicLink, rejectViaMagicLink } from '../actions';

// Approval form. Posts to the real magic-link consumer actions which:
// hash the token, look up the magic_links row, verify it's unconsumed and
// unexpired, run the appropriate state-machine transition, atomically
// propagate (on approve), mark consumed, insert the audit row.
//
// On success the action redirects to /approve/[token]?status=approved
// (or =rejected) and the parent page renders the corresponding success
// card. We catch and surface only real failures here — Next's internal
// NEXT_REDIRECT throw is intentionally swallowed.

export function ApprovalForm({ token }: { token: string }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
          disabled={pending}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-2 sm:flex sm:gap-3 sm:space-y-0">
        <button
          type="button"
          disabled={pending}
          onClick={() => handle('approve')}
          className="block w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-1"
        >
          {pending ? 'Submitting…' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => handle('reject')}
          className="block w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:flex-1"
        >
          Request changes
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        Single-use link. Once you act, the link can&rsquo;t be reused.
      </p>
    </div>
  );

  function handle(kind: 'approve' | 'reject') {
    setError(null);
    if (kind === 'reject' && !comment.trim()) {
      setError('Please add a comment explaining what changes you need.');
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('token', token);
        if (kind === 'reject') {
          formData.set('comment', comment.trim());
          await rejectViaMagicLink(formData);
        } else {
          await approveViaMagicLink(formData);
        }
        // Action redirects on success — control doesn't return.
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Action failed';
        if (message.includes('NEXT_REDIRECT')) return;
        setError(message);
      }
    });
  }
}
