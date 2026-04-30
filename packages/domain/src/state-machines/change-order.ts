// ChangeOrder state machine. The transition to 'approved' triggers atomic
// propagation across Subcontract.current_amount and SoVLine.current_amount.
// See docs/gc-state-machines.md § 3 and docs/gc-data-model.md Invariant #4.

export type ChangeOrderState =
  | { kind: 'draft' }
  | { kind: 'pending_principal'; at: Date }
  | { kind: 'pending_architect'; magicLinkId: string; at: Date }
  | { kind: 'architect_rejected'; comment: string; at: Date }
  | { kind: 'pending_owner'; magicLinkId: string; at: Date }
  | { kind: 'owner_rejected'; comment: string; at: Date }
  | { kind: 'approved'; at: Date }
  | { kind: 'cancelled'; reason: string; at: Date };

export type ChangeOrderEvent =
  | { kind: 'submit_to_principal' }
  | { kind: 'principal_approve'; magicLinkId: string }
  | { kind: 'principal_reject'; comment: string }
  | { kind: 'architect_approve'; magicLinkId: string }
  | { kind: 'architect_reject'; comment: string }
  | { kind: 'pm_revise_after_rejection' }
  | { kind: 'owner_approve' }
  | { kind: 'owner_reject'; comment: string }
  | { kind: 'cancel'; reason: string };
