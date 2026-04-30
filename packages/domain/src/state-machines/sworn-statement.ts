// SwornStatement state machine. Lifecycle parallels its parent
// OwnerPayApplication — they share magic-links and advance in lockstep.
// See docs/gc-state-machines.md § 4.

export type SwornStatementState =
  | { kind: 'generated'; at: Date }
  | { kind: 'signed'; at: Date }
  | { kind: 'notarized'; at: Date }
  | { kind: 'sent_to_architect'; magicLinkId: string; at: Date }
  | { kind: 'architect_approved'; at: Date }
  | { kind: 'sent_to_owner'; magicLinkId: string; at: Date }
  | { kind: 'owner_approved'; at: Date }
  | { kind: 'archived'; at: Date };

export type SwornStatementEvent =
  | { kind: 'upload_signed_pdf' }
  | { kind: 'upload_notarized_pdf' }
  | { kind: 'send_to_architect'; magicLinkId: string }
  | { kind: 'architect_approve' }
  | { kind: 'send_to_owner'; magicLinkId: string }
  | { kind: 'owner_approve' }
  | { kind: 'archive' };
