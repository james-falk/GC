# Product Summary

A multi-tenant SaaS for SMB commercial general contractors managing the monthly pay-app cycle, change orders, schedule of values, subcontract administration, and reconciliation across subs, internal teams, architects, and owners.

## Problems addressed

- Schedule of values, change order tracker, and forecast each maintained in separate Excel files that must reconcile manually.
- Subcontracts, COIs, signed change orders, and pay-app PDFs scattered across drive folders, email attachments, and paper files.
- Subcontractor pay applications submitted in inconsistent PDF formats requiring manual data re-entry.
- Pay app submissions sitting unacknowledged in inboxes due to unclear ownership.
- Change orders approved by owners but not propagated to subcontract ceilings or schedule of values, causing invoices to be held.
- Multiple change orders in flight simultaneously across approval stages with no centralized status view.
- Compliance documents (lien waivers, COIs, certified payroll, prevailing wage) missed at month-end.
- Reconciliation required across Excel, AIA / Cantina-style billing tools, QuickBooks, and bank statements.

## Capabilities

- Single source of truth for SoV, subcontracts, change orders, pay applications (sub→GC and GC→owner), supporting documents, sworn statements, and audit trail.
- Subcontractor submission portal (mobile + desktop) with line-item validation against contract ceiling.
- AI extraction from PDF for non-portal subcontractor submissions (Phase 2).
- Atomic change order propagation: owner approval triggers single-transaction update of subcontract ceiling and affected SoV lines.
- Continuous drift detection surfacing invariant violations (sub billing above ceiling, unpropagated change order, rollup mismatch, missing waiver) on a dashboard.
- Approval routing with explicit ownership at each stage.
- AIA G702/G703-compatible pay-app generation, sworn statements, and multi-party approval flow: PM → Principal → Architect → Owner.
- Architects and owners approve via magic-link email; no account required.
- QuickBooks-compatible CSV export. Two-way API integration in Phase 2.
- Document vault with polymorphic attachments per project, subcontract, change order, and pay application.

## Target customer

$5M–$50M commercial and institutional general contractors using QuickBooks. Single-firm or multi-project. Hosted, multi-tenant, ready for onboarding in a day.

## Pricing

$799 / month flat per firm. No per-seat, per-project, per-subcontractor, or usage fees.
$299 / month tier for specialty trades and sub-$5M GCs.

## Roadmap horizon

- 6-week MVP: capabilities listed above, excluding AI PDF extraction and QuickBooks API.
- 6-month v1: AI PDF extraction, QuickBooks API two-way integration, lien waiver management, compliance document tracking, full external accounts for architects and owners, WIP report generation, DocuSign integration.

## Contact

James Falk · 734-299-0178 · jfalksolutions@gmail.com
