// Mock drift alerts for the Drift Dashboard demo. See gc-data-model.md
// § Invariants — these are example violations of invariants 1, 3, and 4
// shaped on the seed fixture (Brothers & Bricks, project 215, March 2026).
//
// Phase A scope: data only renders to the dashboard + detail views. Real
// drift detection (the pure-function invariants running against live data
// in a scheduled job + write-time check) lands when CO propagation is wired.

export type DriftSeverity = 'high' | 'medium' | 'info';

export type DriftAlert = {
  id: string;
  severity: DriftSeverity;
  type:
    | 'sub_above_ceiling'
    | 'co_not_propagated'
    | 'pay_app_rollup_mismatch';
  typeLabel: string;
  projectName: string;
  projectNumber: string;
  brief: string;
  detectedAt: string; // human-readable
  // Detail-view content
  whatsWrong: string;
  whereTheData: Array<{ label: string; href: string }>;
  howToFix: Array<{ label: string; description: string; primary: boolean }>;
  history: Array<{ at: string; note: string }>;
};

export const MOCK_ALERTS: DriftAlert[] = [
  {
    id: 'sub-above-ceiling-1',
    severity: 'high',
    type: 'sub_above_ceiling',
    typeLabel: 'Sub above ceiling',
    projectName: 'Lincoln Elementary Renovation Phase 2',
    projectNumber: '215',
    brief:
      'Brothers & Bricks Masonry submitted a pay app that exceeds their current contract ceiling.',
    detectedAt: '17 minutes ago',
    whatsWrong:
      'Brothers & Bricks Masonry billed $620,000 cumulative on subcontract 215-002, but the current contract ceiling is $576,622. This is the kind of violation that creates payment disputes downstream — the GC can\'t pay above the ceiling without a CO, and the sub assumes their work was authorized.',
    whereTheData: [
      { label: 'Subcontract 215-002 (Brothers & Bricks)', href: '/projects' },
      { label: 'March 2026 sub pay app', href: '/projects' },
      { label: 'SoV line 3 — Masonry', href: '/projects' },
    ],
    howToFix: [
      {
        label: 'Submit a change order to increase the ceiling',
        description:
          'If the additional work was actually authorized, this is a missing CO. Drafts the CO with the affected subcontract pre-selected.',
        primary: true,
      },
      {
        label: 'Reject this sub pay app submission',
        description:
          'If the sub overbilled, kick the pay app back to needs_revision with a comment.',
        primary: false,
      },
      {
        label: 'Mark as acknowledged',
        description:
          'Silences the alert without fixing — only for true edge cases (e.g., known reconciliation we accept).',
        primary: false,
      },
    ],
    history: [
      { at: '17 min ago', note: 'Detected on pay-app submission' },
      { at: '3 days ago', note: 'Sub last submitted within ceiling' },
    ],
  },
  {
    id: 'co-not-propagated-1',
    severity: 'high',
    type: 'co_not_propagated',
    typeLabel: 'CO not propagated',
    projectName: 'Lincoln Elementary Renovation Phase 2',
    projectNumber: '215',
    brief:
      'CO 215-CO-001 transitioned to approved 3 days ago but the affected subcontract\'s current amount has not updated.',
    detectedAt: '3 days ago',
    whatsWrong:
      'Change Order 215-CO-001 was approved by the owner on Mar 28, 2026, with a total of +$34,700 against subcontract 215-002 (Brothers & Bricks). The propagation should have updated subcontract.current_amount from $576,622 to $611,322 and adjusted SoV lines 3a, 3b, 3c — but it didn\'t. This is the most expensive class of drift: the system thinks the sub is still on the old ceiling, but the CO trail says they have more authorized work.',
    whereTheData: [
      { label: 'CO 215-CO-001', href: '/projects' },
      { label: 'Subcontract 215-002', href: '/projects' },
      { label: 'SoV lines 3a, 3b, 3c', href: '/projects' },
    ],
    howToFix: [
      {
        label: 'Re-run propagation',
        description:
          'Replays the atomic transaction: updates Subcontract.current_amount, updates each affected SoVLine.current_amount, and inserts an approval_event record. If anything fails, all rolls back.',
        primary: true,
      },
      {
        label: 'Inspect the approval_events log',
        description:
          'Look at the event history for CO 215-CO-001 to see why the original transition didn\'t complete.',
        primary: false,
      },
    ],
    history: [
      { at: '3 days ago', note: 'CO approved by owner; propagation should have fired' },
      { at: '5 days ago', note: 'CO sent to owner' },
      { at: '11 days ago', note: 'CO created' },
    ],
  },
  {
    id: 'pay-app-rollup-1',
    severity: 'medium',
    type: 'pay_app_rollup_mismatch',
    typeLabel: 'Pay app rollup mismatch',
    projectName: 'Lincoln Elementary Renovation Phase 2',
    projectNumber: '215',
    brief:
      'March 2026 sub pay-app totals do not reconcile with the GC→Owner pay app for the same period.',
    detectedAt: '2 hours ago',
    whatsWrong:
      'Approved sub pay apps for March 2026 sum to $268,313.30 of billable work. The GC→Owner pay app for the same period bills $267,066.00. Reconciliation gap: $1,247.30. Possible causes: a sub pay app was approved after the owner pay app was generated, or a GC-internal SoV line was missed in the rollup.',
    whereTheData: [
      { label: 'March 2026 owner pay app', href: '/projects' },
      { label: 'All approved sub pay apps for the period', href: '/projects' },
    ],
    howToFix: [
      {
        label: 'Regenerate the owner pay app',
        description:
          'Picks up any sub pay apps approved after the original generation and recomputes totals.',
        primary: true,
      },
      {
        label: 'Mark as acknowledged',
        description:
          'If the gap is intentional (e.g., a contested sub line you\'re not passing through), silence the alert with a comment.',
        primary: false,
      },
    ],
    history: [
      { at: '2 hours ago', note: 'Detected during nightly drift scan' },
      { at: '5 days ago', note: 'Owner pay app generated' },
    ],
  },
];

export const SEVERITY_STYLES: Record<DriftSeverity, { dot: string; chip: string; label: string }> = {
  high: {
    dot: 'bg-red-500',
    chip: 'bg-red-100 text-red-800',
    label: 'High',
  },
  medium: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800',
    label: 'Medium',
  },
  info: {
    dot: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-800',
    label: 'Info',
  },
};
