# Scenario 6 — Recovery: mistakes don't break the project

**Duration:** ~50 seconds
**Persona:** Lena Torres

The story: brief capstone. Soft delete on projects, cancel-with-reason
on COs and sub pay-apps. The narrator's job is to say "your team will
make mistakes and the system survives them."

---

## Beat 1 (00:00–00:10)

[Screen: Quick: /projects/new, fill in "Demo throwaway" / $100,000.
Create. Lands on the new project page.]

> Lena spins up a throwaway project to show the recovery flow. New
> assistant clicks the wrong button — happens every week.

## Beat 2 (00:10–00:18)

[Screen: Click Archive on the project header. Confirmation. Back to
projects list. Demo throwaway is gone.]

> She archives it. Disappears from the active list. Procore would let
> you hard-delete this and lose everything attached.

## Beat 3 (00:18–00:27)

[Screen: Navigate to /projects?showArchived=true. Demo throwaway shows up
with archived banner.]

> Append showArchived=true to the URL. Archived projects come back,
> read-only, with a banner explaining the state.

## Beat 4 (00:27–00:35)

[Screen: Click Restore on the archived row. Project returns to active.
All subs, SoV lines, pay apps still intact.]

> Restore. The project comes back with every subcontract, SoV line,
> pay-app, and change order untouched. Soft delete by design — every
> row is recoverable until you hard-delete the tenant.

## Beat 5 (00:35–00:50)

[Screen: Navigate to Change Orders → expand the "cancel" disclosure on a
draft CO → type reason "Demo cancellation" → click Cancel CO. Row flips
to "cancelled" with the reason in the audit log.]

> Same pattern for change orders and sub pay-apps. Cancel-with-reason,
> not delete. The reason ends up in the approval-events audit table.
> Anyone reviewing a project six months later can see why a CO was
> killed, by whom, and when.
