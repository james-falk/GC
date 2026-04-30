// Approval trail timeline. See gc-wireframes-brief.md § Screen 8 right panel.
//
// Status icons follow the wireframe spec:
//   - check (done)        — step is complete
//   - clock (pending)     — step is upcoming, not yet reached
//   - x     (rejected)    — step rejected (skipped here; only used post-MVP)
//
// In Phase A foundation: shown in draft state — only "Created" is complete,
// the rest are pending. When CO state machines are wired (Day 5), this will
// reflect the real state.

type Step = {
  label: string;
  hint?: string;
  status: 'done' | 'pending';
};

const DRAFT_STEPS: Step[] = [
  { label: 'Created', hint: 'Just now', status: 'done' },
  { label: 'Submitted to Principal', status: 'pending' },
  { label: 'Sent to Architect', hint: 'magic-link', status: 'pending' },
  { label: 'Architect approved', status: 'pending' },
  { label: 'Sent to Owner', hint: 'magic-link', status: 'pending' },
  { label: 'Owner approved', status: 'pending' },
  { label: 'Auto-propagated', hint: 'subcontract + SoV updated', status: 'pending' },
];

export function ApprovalTrail() {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold tracking-tight text-slate-900">Approval trail</h3>
      <p className="mt-1 text-xs text-slate-500">
        Each step records timestamp + actor + (where applicable) a magic-link to
        the external party.
      </p>
      <ol className="mt-5 space-y-4">
        {DRAFT_STEPS.map((step, idx) => {
          const isLast = idx === DRAFT_STEPS.length - 1;
          return (
            <li key={step.label} className="relative flex gap-3">
              {/* Connector line */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 h-[calc(100%+0.5rem)] w-px bg-slate-200"
                />
              )}
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                {step.status === 'done' ? (
                  <CheckIcon className="h-5 w-5 text-blue-700" />
                ) : (
                  <ClockIcon className="h-5 w-5 text-slate-300" />
                )}
              </span>
              <div className="-mt-0.5">
                <div
                  className={
                    'text-sm ' +
                    (step.status === 'done'
                      ? 'font-medium text-slate-900'
                      : 'text-slate-500')
                  }
                >
                  {step.label}
                </div>
                {step.hint && (
                  <div className="mt-0.5 text-xs text-slate-500">{step.hint}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        On owner approval, the system updates the affected subcontract&rsquo;s
        current amount and each affected SoV line&rsquo;s current amount in a
        single transaction. Either everything propagates, or nothing does.
      </p>
    </aside>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <circle cx="10" cy="10" r="7" />
      <path strokeLinecap="round" d="M10 6.5V10l2.25 1.5" />
    </svg>
  );
}
