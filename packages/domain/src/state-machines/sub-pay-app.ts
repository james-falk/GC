// SubPayApplication state machine — pay app submitted by a subcontractor up
// to the GC (PayApplication.direction = 'sub_to_gc').
// See docs/gc-state-machines.md § 1.

export type SubPayAppState =
  | { kind: 'draft' }
  | { kind: 'submitted'; submittedAt: Date }
  | { kind: 'needs_revision'; comment: string; at: Date }
  | { kind: 'approved_by_pm'; at: Date }
  | { kind: 'approved_by_principal'; at: Date }
  | { kind: 'approved'; at: Date }
  | { kind: 'included_in_owner_pay_app'; ownerPayAppId: string; at: Date }
  | { kind: 'paid'; at: Date }
  | { kind: 'cancelled'; reason: string; at: Date };

export type SubPayAppEvent =
  | { kind: 'submit' }
  | { kind: 'pm_approve' }
  | { kind: 'pm_request_revision'; comment: string }
  | { kind: 'sub_resubmit' }
  | { kind: 'principal_approve' }
  | { kind: 'system_auto_approve' }
  | { kind: 'system_roll_into_owner'; ownerPayAppId: string }
  | { kind: 'mark_paid' }
  | { kind: 'cancel'; reason: string };
