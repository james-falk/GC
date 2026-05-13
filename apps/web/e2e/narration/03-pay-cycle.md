# Scenario 3 — Monthly pay cycle: sub → GC → owner, no Excel

**Duration:** ~120 seconds
**Persona:** Lena Torres + cameos from sub portal + owner inbox

The story: end of April. Lena starts the cycle, three subs submit via
their mobile magic-link portals, Lena reviews and adjusts one sub down,
the owner pay-app rolls up, the owner signs off, the check clears,
AIA G702 and G703 PDFs render from real data.

The longest scenario but the one that proves "we replace the entire
monthly close, not just one form."

---

## Beat 1 (00:00–00:10)

[Screen: Lincoln Elementary → Pay Apps tab → fill period dates
April 1 to April 30 → click Start.]

> End of April. Lena starts the monthly pay-app cycle. One click.
> The system creates a pay-app and a single-use magic-link for every
> active subcontract.

## Beat 2 (00:10–00:20)

[Screen: Green banner with three sub URLs, three emails arrive in inbox
simultaneously. Each email shows project name, contractor, "Open pay-app"
button.]

> Three URLs. Three emails. Brothers and Bricks, Apex Electric,
> Solid Mechanical — each sub gets a link delivered through Resend
> with the project context already in the subject line.

## Beat 3 (00:20–00:32)

[Screen: Incognito tab, open Brothers and Bricks URL on a phone viewport.
Mobile-first form renders. Shows only lines 3a and 3b — NOT parent line 3.]

> The sub opens the link on their phone. Mobile-first form, scoped to
> just their SoV lines. Notice: they only see three-A and three-B, the
> leaves. The parent line three is hidden — so they can't accidentally
> bill the parent and the children both.

## Beat 4 (00:32–00:45)

[Screen: Sub fills in: line 3a at 35%, line 3b at 20%. Stored materials $5,000
on 3a. Hit "Save draft" → green confirmation banner.]

> Brothers and Bricks fills in thirty-five percent on brick, twenty on
> block, five thousand in stored materials. Hits Save Draft. Closes the
> tab. Comes back tomorrow morning. Same link, same values pre-filled.

## Beat 5 (00:45–00:55)

[Screen: Click Submit. "Submitted." card. Magic-link is now consumed.]

> Today they're ready. Submit. Single click. The link is now consumed —
> nobody can re-use it to game the system later.

## Beat 6 (00:55–01:08)

[Screen: Back in GC tab. Pay Apps list. Brothers and Bricks row now shows
"submitted". Lena clicks into the review.]

> Lena sees the submission. She clicks into the review screen.

## Beat 7 (01:08–01:24)

[Screen: Review table. Sub reported column shows 35% on brick. GC adjusted
column also shows 35%. Lena edits GC adjusted down to 25%. "This period $"
in the row recomputes live. Yellow flag appears: "Reduced from 35%".]

> She lowers brick from thirty-five to twenty-five. The walk-through
> last week showed less than they billed. This-period dollars
> recompute live. The row flags the reduction so the audit trail
> captures it.

## Beat 8 (01:24–01:34)

[Screen: Click "Approve sub pay app". Redirect to Pay Apps list. Row now
"approved". Close. Reopen by clicking back into the row.]

> Approve. Reopens the row a second later. The twenty-five percent
> override is still there. Procore doesn't persist this — the next
> reviewer sees the sub's number again. We don't make that mistake.

## Beat 9 (01:34–01:48)

[Screen: Repeat fast for Apex (approve at 25%) and Solid (approve at 15%).
All three subs now "approved".]

> Same flow for Apex Electric and Solid Mechanical. Faster the second
> time — Lena's already memorized the muscle pattern. Three submissions,
> three approvals, about ninety seconds total.

## Beat 10 (01:48–02:00)

[Screen: Assemble owner pay-app form. Fill April 1 to April 30. Click
Assemble. New gc_to_owner row appears, status "generated".]

> Now she rolls everything up into one owner pay-app. April 1 to
> April 30. The system aggregates every approved sub line into a
> single AIA G702 record, preserving the line-by-line trace.

## Beat 11 (02:00–02:12)

[Screen: Click "Send to owner" on the owner pay-app row. Green banner.
Email arrives in owner inbox.]

> Send to owner. Magic-link minted, email out. Status: sent to owner.
> The owner can open the link from their phone — same single-use
> bearer credential pattern as everything else.

## Beat 12 (02:12–02:24)

[Screen: Owner incognito tab. Approve page renders the AIA pay-app
summary with line totals and retention. Owner clicks Approve.]

> Owner reviews the pay-app summary. Net due after retention is
> the bottom line they care about. They approve.

## Beat 13 (02:24–02:34)

[Screen: GC tab. Row "owner_approved". Wait a beat. Click "Mark paid".
Row "paid".]

> A week later, the check clears the bank. Lena marks the pay-app
> paid. The chain is closed.

## Beat 14 (02:34–02:45)

[Screen: AIA pay app page. G702 PDF in iframe, G703 below or in tab.
PDFs show the GC-adjusted numbers, not the sub-reported.]

> The G702 and G703 PDFs render on demand from the database. Notice
> the brick line at twenty-five percent — Lena's adjustment, not the
> sub's original thirty-five. The whole chain consistent end-to-end.
> No exports, no re-keying, no drift.
