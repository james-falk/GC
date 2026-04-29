# construct-app — State Machines

Authoritative reference for state transitions. Use this as the source for Whimsical state diagrams.

Three core state machines:
1. SubPayApplication (direction=sub_to_gc)
2. OwnerPayApplication (direction=gc_to_owner)
3. ChangeOrder
4. SwornStatement

Plus one cross-cutting concern: external magic-link approval (used by ChangeOrder and OwnerPayApplication).

---

## 1. SubPayApplication state machine

Pay application submitted by a subcontractor up to the GC.

### States

| State | Meaning |
|---|---|
| `draft` | Sub is filling out the form, not yet submitted |
| `submitted` | Sub clicked "Submit", waiting for GC PM review |
| `needs_revision` | GC PM rejected with comments; sub re-editing |
| `approved_by_pm` | PM approved; if total < principal threshold, transitions to `approved`. Else awaits Principal. |
| `approved_by_principal` | Principal approved (only entered if total ≥ threshold) |
| `approved` | Final approved state. Can be rolled into a GC→Owner pay app for the same period. |
| `included_in_owner_pay_app` | Rolled into a generated owner pay app (terminal until period closes) |
| `paid` | Owner has paid; AP has paid the sub. Terminal. |
| `cancelled` | Cancelled before approval. Terminal. |

### Transitions

| From | Event | To | Guard |
|---|---|---|---|
| (none) | sub creates draft | `draft` | sub must be invited to this subcontract |
| `draft` | sub clicks Submit | `submitted` | passes invariant #1 (ceiling check) |
| `submitted` | PM clicks Approve | `approved_by_pm` | PM role required |
| `submitted` | PM clicks Request Revision | `needs_revision` | PM role required, comment required |
| `needs_revision` | sub clicks Resubmit | `submitted` | re-passes ceiling check |
| `approved_by_pm` | (auto) total < threshold | `approved` | system rule |
| `approved_by_pm` | Principal approves | `approved_by_principal` | total ≥ threshold |
| `approved_by_principal` | (auto) | `approved` | system rule |
| `approved` | system rolls into owner pay app | `included_in_owner_pay_app` | matching period exists |
| `included_in_owner_pay_app` | owner pay app marked paid | `paid` | OwnerPayApp transitions to `paid` |
| `draft` / `needs_revision` | sub or PM cancels | `cancelled` | with reason |

### Notes for Whimsical
- Double-circle terminal states: `paid`, `cancelled`
- Bold the auto-transition arrows (system-driven)
- Annotate with guards in italics

---

## 2. OwnerPayApplication state machine

Pay application from GC up to project owner. Generated from approved sub pay apps for a period.

### States

| State | Meaning |
|---|---|
| `draft` | System has assembled it; PM can still adjust before generating PDF |
| `generated` | PDF generated, awaiting Principal signature |
| `signed` | Principal has signed, signed PDF uploaded |
| `notarized` | Notarized PDF uploaded |
| `sent_to_architect` | Magic-link sent to architect |
| `architect_rejected` | Architect requested changes |
| `architect_approved` | Architect approved |
| `sent_to_owner` | Magic-link sent to owner |
| `owner_rejected` | Owner requested changes |
| `owner_approved` | Owner approved (formally accepts the bill) |
| `paid` | Owner has paid. Terminal. |
| `cancelled` | Cancelled. Terminal. |

### Transitions

| From | Event | To | Guard |
|---|---|---|---|
| (none) | system assembles from approved sub pay apps | `draft` | period has at least one approved sub pay app |
| `draft` | PM clicks Generate | `generated` | passes invariant #3 (rollup check) |
| `generated` | uploads signed PDF | `signed` | file is valid PDF |
| `signed` | uploads notarized PDF | `notarized` | file is valid PDF |
| `notarized` | clicks Send to Architect | `sent_to_architect` | magic-link created with TTL 72h |
| `sent_to_architect` | architect approves via link | `architect_approved` | link not expired/consumed |
| `sent_to_architect` | architect rejects via link | `architect_rejected` | link not expired/consumed; comment required |
| `architect_rejected` | PM addresses & re-generates | `generated` | system rule |
| `architect_approved` | clicks Send to Owner | `sent_to_owner` | magic-link created |
| `sent_to_owner` | owner approves via link | `owner_approved` | link not expired/consumed |
| `sent_to_owner` | owner rejects via link | `owner_rejected` | link not expired/consumed; comment required |
| `owner_rejected` | PM addresses & re-generates | `generated` | system rule |
| `owner_approved` | finance marks paid | `paid` | finance role required |
| any non-terminal | PM cancels | `cancelled` | reason required |

### Side effects
- `paid`: cascades to all included sub pay apps → their state transitions to `paid`
- `architect_rejected` / `owner_rejected`: triggers email notification to PM with rejection comment

---

## 3. ChangeOrder state machine

The cleanest, most important state machine. **Approved transitions atomically propagate to SoV + Subcontract.**

### States

| State | Meaning |
|---|---|
| `draft` | PM is drafting |
| `pending_principal` | Submitted to Principal for internal sign-off |
| `pending_architect` | Sent via magic-link to architect |
| `architect_rejected` | Architect rejected; PM revising |
| `pending_owner` | Architect approved; sent to owner via magic-link |
| `owner_rejected` | Owner rejected; PM revising |
| `approved` | Owner approved → **propagation triggered atomically** |
| `cancelled` | Cancelled. Terminal. |

### Transitions

| From | Event | To | Guard |
|---|---|---|---|
| (none) | PM creates draft | `draft` | PM role required |
| `draft` | PM clicks Submit | `pending_principal` | total_amount computed, at least one ChangeOrderLine |
| `pending_principal` | Principal approves | `pending_architect` | magic-link created for architect |
| `pending_principal` | Principal rejects | `draft` | comment required |
| `pending_architect` | architect approves via link | `pending_owner` | link not expired/consumed; magic-link created for owner |
| `pending_architect` | architect rejects via link | `architect_rejected` | link not expired/consumed; comment required |
| `architect_rejected` | PM revises | `pending_principal` | re-submit |
| `pending_owner` | owner approves via link | **`approved`** | link not expired/consumed; **TRIGGERS PROPAGATION** |
| `pending_owner` | owner rejects via link | `owner_rejected` | comment required |
| `owner_rejected` | PM revises | `pending_principal` | re-submit |
| any non-terminal | PM cancels | `cancelled` | reason required |

### Critical side effect: propagation on `approved`

When transitioning to `approved`, the system in **a single database transaction**:
1. `Subcontract.current_amount += ChangeOrder.total_amount` (for affected_subcontract_id)
2. For each ChangeOrderLine: `SoVLine.current_amount += delta_amount`
3. Insert ApprovalEvent with `to_status='approved'`
4. Notify the PM and any subs whose ceiling just changed
5. If transaction fails for any reason, **all rollback** — CO stays in `pending_owner`. No partial propagation.

### Notes for Whimsical
- Highlight `approved` state with a starburst or distinctive marker — this is the "magic moment"
- Annotate the `pending_owner → approved` transition with "TRIGGERS PROPAGATION" in red
- Show the magic-link transitions as dashed lines (external actor)

---

## 4. SwornStatement state machine

Lifecycle parallels the OwnerPayApplication it's attached to.

### States

| State | Meaning |
|---|---|
| `generated` | PDF generated from the approved owner pay app |
| `signed` | Principal-signed PDF uploaded |
| `notarized` | Notarized PDF uploaded |
| `sent_to_architect` | Sent with the owner pay app for architect review |
| `architect_approved` | Architect approved (alongside the pay app) |
| `sent_to_owner` | Sent with the owner pay app for owner review |
| `owner_approved` | Owner approved |
| `archived` | Project closed; sworn statement is the final/closeout one |

### Transitions

Same actor + event pattern as OwnerPayApplication. The sworn statement transitions in lockstep with its parent pay app — when the pay app advances, the statement advances. They share the same magic-links.

### Notes for Whimsical
- Draw side-by-side with OwnerPayApplication state diagram — they mirror each other
- Visual hint that sworn statement is "carried along" with pay app (e.g., dotted association line between corresponding states)

---

## 5. Cross-cutting: External Magic-Link Approval

Used by ChangeOrder (architect, owner) and OwnerPayApplication (architect, owner).

### Lifecycle

```
created → sent → opened (optional, tracked) → consumed
                                             ↘ expired (TTL hit before consumption)
```

### Properties
- TTL default 72 hours, configurable per tenant
- Single-use: `consumed_at` is set on first action (approve OR reject); subsequent visits return 410 Gone
- Token: cryptographically random 32-byte string; stored hashed in `MagicLink.token_hash`. Raw token only exists in the URL sent via email.
- On consumption: triggers the parent entity's state transition AND inserts ApprovalEvent

### Notes for Whimsical
- Diagram once as a separate small state machine, reference from CO and OwnerPayApplication diagrams
- Emphasize single-use + TTL — common source of "why didn't my approval work" support questions

---

## Summary table

| Machine | Actor types involved | Has external approval? | Has propagation side effect? |
|---|---|---|---|
| SubPayApplication | sub_user, pm, principal | No (all internal) | No |
| OwnerPayApplication | pm, principal, finance, architect, owner | Yes (architect + owner) | Cascades on `paid` |
| ChangeOrder | pm, principal, architect, owner | Yes (architect + owner) | **Atomic propagation on `approved`** |
| SwornStatement | pm, principal, architect, owner | Yes (shared w/ pay app) | No |
| MagicLink | architect or owner | — | Triggers parent transition |
