// OwnerPayApplication state machine — pay app from GC up to project owner
// (PayApplication.direction = 'gc_to_owner'). Generated from approved sub
// pay apps for a period.
// See docs/gc-state-machines.md § 2.

export type OwnerPayAppState =
  | { kind: 'draft' }
  | { kind: 'generated'; at: Date }
  | { kind: 'signed'; at: Date }
  | { kind: 'notarized'; at: Date }
  | { kind: 'sent_to_architect'; magicLinkId: string; at: Date }
  | { kind: 'architect_rejected'; comment: string; at: Date }
  | { kind: 'architect_approved'; at: Date }
  | { kind: 'sent_to_owner'; magicLinkId: string; at: Date }
  | { kind: 'owner_rejected'; comment: string; at: Date }
  | { kind: 'owner_approved'; at: Date }
  | { kind: 'paid'; at: Date }
  | { kind: 'cancelled'; reason: string; at: Date };

export type OwnerPayAppEvent =
  | { kind: 'generate' }
  | { kind: 'upload_signed_pdf' }
  | { kind: 'upload_notarized_pdf' }
  | { kind: 'send_to_architect'; magicLinkId: string }
  | { kind: 'architect_approve' }
  | { kind: 'architect_reject'; comment: string }
  | { kind: 'pm_revise_after_rejection' }
  | { kind: 'send_to_owner'; magicLinkId: string }
  | { kind: 'owner_approve' }
  | { kind: 'owner_reject'; comment: string }
  | { kind: 'finance_mark_paid' }
  | { kind: 'cancel'; reason: string };
