# Scenario 5 — Sworn statement: the compliance chain

**Duration:** ~70 seconds
**Persona:** Lena Torres

The story: Illinois (and 30-plus other states) require a notarized
sworn statement of contractor alongside the AIA pay-app. Eight states
in the workflow: generated, signed by Principal, notarized, sent to
architect, architect approved, sent to owner, owner approved, archived.

The point: the same state-machine pattern from COs and pay-apps,
applied to compliance paperwork. Boring but mandatory.

---

## Beat 1 (00:00–00:08)

[Screen: Lincoln Elementary → Pay Apps → click "Sworn statement" link.
Empty state with "Generate from latest owner pay-app" button.]

> Illinois requires a notarized affidavit of contractor alongside
> every pay-app. Most states do. Lena generates it from the April
> owner pay-app she just sent.

## Beat 2 (00:08–00:18)

[Screen: Click Generate. PDF renders in iframe. Status flow sidebar on
the right shows 8 dots — only the first ("Generated") is lit.]

> The PDF renders from the same database the AIA G702 came from. No
> double-entry. Sub-by-sub billed-to-date totals, automatically pulled
> from the approved pay-app records.

## Beat 3 (00:18–00:28)

[Screen: Click "Mark signed". Status flow advances — second dot lights.
Then "Mark notarized". Third dot lights.]

> Principal signs. Notary stamps. Lena clicks through both transitions
> in-app. Each click writes an approval-event audit row to the database.

## Beat 4 (00:28–00:42)

[Screen: Click "Send to architect". Green banner with architect URL. Then
"Architect approved" (records out-of-band approval). Fifth dot lights.]

> Send to the architect. Same magic-link mechanism as everything else,
> just pointed at the sworn statement instead of the CO. Architect
> reviews, signs off out-of-band, Lena records their approval in-app.

## Beat 5 (00:42–00:55)

[Screen: "Send to owner". Magic-link banner. Then "Owner approved".
Seventh dot lights.]

> Send to the owner. The owner reviews, approves, Lena records.

## Beat 6 (00:55–01:10)

[Screen: Click Archive. Eighth dot lights — all eight states completed.
Sidebar shows the full chain in solid blue dots top to bottom.]

> Archive. The statement is now a permanent project artifact. Every
> transition top to bottom has an audit row, a timestamp, and an actor.
> Compliance team can replay the whole sequence on demand.
