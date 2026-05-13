# Scenario 2 — Change Order: the wedge moment

**Duration:** ~110 seconds
**Persona:** Lena Torres, with cameos from the architect and owner inboxes

The story: three weeks in, the owner approves a $34,700 additive for
brick wall extension. This is the demo's signature beat — Principal,
Architect, Owner approvals chained through magic-links, with atomic
propagation hitting the subcontract and SoV lines in lockstep.

This is the scenario where Spartan should lean in.

---

## Beat 1 (00:00–00:10)

[Screen: Lincoln Elementary project, Change Orders tab → Draft change order.]

> Three weeks in. The owner approved a south entrance brick wall
> extension. Thirty-four thousand seven hundred dollars. Lena drafts
> change order CO-001 against the Brothers and Bricks subcontract.

## Beat 2 (00:10–00:25)

[Screen: Add three line items: 3a brick +$8,400, 3b block +$24,200,
3 labor +$2,100. Total auto-calculates.]

> Three line items. Eight-four hundred more brick, twenty-four two
> hundred more block, twenty-one hundred for labor escalation. Total
> ticks up to thirty-four thousand seven hundred automatically.

## Beat 3 (00:25–00:35)

[Screen: Save as draft. CO row appears in list, status "draft". Click
"Submit to Principal".]

> She submits the draft to the Principal. Internal review only — no
> external party touches anything until Spartan's signed off.

## Beat 4 (00:35–00:48)

[Screen: Principal approves. Status → "pending_architect". Green banner
appears with architect magic-link URL.]

> The Principal approves. The system generates a single-use magic-link
> to the architect — emailed via Resend, also surfaced here in the
> banner. Single-use, valid for 72 hours, the hash lives in the
> database, never the raw token.

## Beat 5 (00:48–01:02)

[Screen: New incognito tab. Open the architect URL. Approve consumer
page renders with the CO summary and line items. Click "Approve".]

> The architect opens the link. No login required — the URL itself is
> the bearer credential. They see the same CO summary the GC saw, the
> same line items, the same totals. They approve.

## Beat 6 (01:02–01:14)

[Screen: Back in GC tab → refresh. New green banner with owner magic-link
URL. Status → "pending_owner".]

> The moment the architect clicks approve, the system mints a fresh
> magic-link for the owner. Two seconds later it's in their inbox.
> Same atomic transition that updated the database.

## Beat 7 (01:14–01:28)

[Screen: Another incognito tab. Open owner URL. Owner sees the same CO
+ line items. Clicks "Approve".]

> Owner reviews. Owner approves. Both signatures captured, both audited,
> both timestamps recorded. Now the interesting part.

## Beat 8 (01:28–01:42)

[Screen: GC tab refresh. CO status → "approved". Click Subs tab. Brothers
and Bricks current amount: $454,700 (was $420,000).]

> The subcontract jumped from four-twenty to four-fifty-four,
> seven hundred. Atomic. One transaction.

## Beat 9 (01:42–01:55)

[Screen: SoV tab. Line 3a shows $288,400 (was $280,000). Line 3b shows
$164,200 (was $140,000). Line 3 shows $2,100 (was $0).]

> And the SoV lines moved in lockstep. Three-A by eighty-four hundred,
> three-B by twenty-four two, line three by twenty-one. If the database
> blows up halfway through, none of this commits.

## Beat 10 (01:55–02:05)

[Screen: KPI strip at top — "Contract value $2,434,700" with green delta
"+$34,700 via approved COs". Drift dashboard still shows zero violations.]

> Two-point-four-three-four million. One CO approved. Zero drift.
> That's the loop. No spreadsheet exports, no Procore-to-Sage sync,
> no reconciliation meeting on Friday.
