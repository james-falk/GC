# Scenario 4 — Drift detection: the safety net

**Duration:** ~45 seconds
**Persona:** Lena Torres

The story: even with atomic propagation, a 12-month project drifts.
Manual database edits, partial syncs from QuickBooks, a sub portal
upload that got truncated mid-write. The drift dashboard catches it.

Short scenario. The point isn't to dwell — it's to land "you can sleep
at night because this checks for you."

---

## Beat 1 (00:00–00:10)

[Screen: Click Drift Alerts in sidebar. Page loads. Heading "Drift" with
zero or low alert count.]

> Drift Alerts. Every time this page loads, five invariants run
> against every active project in the tenant.

## Beat 2 (00:10–00:22)

[Screen: Five rule names visible: sub-billable ceiling, SoV integrity,
pay-app rollup, CO not propagated, retention balance.]

> Sub-billable ceiling — a sub can't bill more than their subcontract
> allows. SoV integrity — line totals match the project. Pay-app
> rollup — owner pay-app equals the sum of approved sub pay-apps.
> CO propagation — no approved CO sits more than five minutes without
> propagating. Retention math ties out to the penny.

## Beat 3 (00:22–00:34)

[Screen: All five rules show green check marks / zero violations.
Highlight the "system consistent" indicator.]

> All five clean. Lincoln Elementary is internally consistent. Because
> the CO chain we just walked through wrote in one transaction, nothing
> drifted in.

## Beat 4 (00:34–00:45)

[Screen: Cursor hovers over each rule briefly, showing brief tooltips
explaining "what this catches".]

> This is the safety net. Manual database edits, partial migrations,
> a Procore export that someone re-imported wrong — drift shows up
> on this page within minutes. Your accountant doesn't find it three
> months later at year-end close. We find it now.
