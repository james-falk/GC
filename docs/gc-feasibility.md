# construct-app — Feasibility & Confidence (Comprehensive)

For internal understanding and the Spartan meeting: every component of the system mapped to delivery confidence on two horizons.

**Confidence legend:**
- 🟢 **High** — well-trodden pattern, many successful precedents in similar stacks, no unknown unknowns
- 🟡 **Moderate** — feasible, but at least one edge case, third-party dependency, or scope sensitivity
- 🔴 **Lower / risk** — possible but tight; likely needs scope cuts, partnerships, or extra time

**Two horizons:**
- **6-week MVP** — first usable version for a design partner
- **6-month v1** — polished, production-ready, multiple paying customers

---

## Executive summary

| Bucket | 6-week MVP | 6-month v1 |
|---|---|---|
| Foundation & infrastructure | 🟢 High | 🟢 High |
| Core data model + CRUD | 🟢 High | 🟢 High |
| Pay app + CO workflows (the wedge) | 🟢 High | 🟢 High |
| Drift detection | 🟢 High | 🟢 High |
| Documents + AIA forms | 🟡 Moderate (close, not pixel-perfect) | 🟢 High |
| Notifications + magic-link approvals | 🟢 High | 🟢 High |
| QuickBooks integration | 🟢 High (CSV export) | 🟡 Moderate (API) |
| AI PDF ingestion | not in scope | 🟡 Moderate |
| Compliance docs (COIs, lien waivers, etc.) | not in scope | 🟢 High |
| Reporting + WIP | not in scope | 🟢 High |
| Mobile field UI | basic responsive only | 🟡 Moderate (full field experience) |
| Operational maturity (SOC 2 path, etc.) | minimal | 🟡 Moderate (audit pending) |
| Distribution / customer acquisition | n/a | 🔴 Hardest part |

**Bottom line:** the engineering is the easy part. What we've designed is delivered with high confidence in a 6-week window, and 6 months gets us to a polished product with 5+ paying customers — *if* distribution efforts run in parallel from day one. Engineering scope risk is low. Business risk is sales & adoption.

---

## 1. Foundation & infrastructure

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| Next.js 15 + React 19 + TS scaffold | 🟢 | 🟢 | 0.5 | One command boilerplate; user already on this stack. |
| pnpm monorepo (apps/web, packages/db/domain/pdf/ui) | 🟢 | 🟢 | 0.5 | Standard structure. Forces clean boundaries. |
| Tailwind v4 + shadcn/ui | 🟢 | 🟢 | 0.5 | Copy-in components we own. |
| Drizzle ORM + migrations | 🟢 | 🟢 | 1 | Type-safe, explicit. `drizzle-kit` for migrations only. |
| Postgres (Neon serverless) | 🟢 | 🟢 | 0.5 | Already provisioned (`construct-app` project). |
| Cloudflare R2 file storage | 🟢 | 🟢 | 0.5 | Already enabled, S3-compatible. |
| Resend email | 🟢 | 🟢 | 0.5 | Connected. React Email templates. |
| Sentry error monitoring | 🟢 | 🟢 | 0.5 | Account exists; SDK integration trivial. |
| Vercel deployment + preview branches | 🟢 | 🟢 | 0.5 | Already wired up. |
| GitHub Actions CI (lint, typecheck, unit) | 🟢 | 🟢 | 1 | Standard YAML. |
| Environment variables strategy (.env.local + Vercel envs) | 🟢 | 🟢 | 0.25 | Locked in plan. |
| Logging strategy (`pino` structured) | 🟢 | 🟢 | 1 | Defer to "when it burns" per plan; basic console+Sentry covers MVP. |

**Sub-total:** ~7 days. **Confidence: 🟢 across both horizons.**

---

## 2. Auth & access control

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| Clerk multi-tenant orgs (= GC firms) | 🟢 | 🟢 | 1 | Clerk's built-in Orgs feature; no custom code. |
| User roles (Principal / Finance / PM / Assistant / Sub / Architect / Owner) | 🟢 | 🟢 | 1 | Clerk roles + middleware checks. |
| Internal user invite flow | 🟢 | 🟢 | 1 | Clerk-hosted invite + custom landing. |
| Sub user invite (per-subcontractor scoped) | 🟢 | 🟢 | 1 | Custom Clerk org with user constrained to one subcontract org. |
| Magic-link tokens (architect/owner) | 🟢 | 🟢 | 2 | Token-based, single-use, TTL-bounded. Custom (not Clerk). |
| Postgres row-level security (RLS) for tenant isolation | 🟡 | 🟢 | 2 | Belt-and-suspenders. Some learning curve setting up policies; well-documented. |
| Session management | 🟢 | 🟢 | 0 | Clerk handles. |
| Password reset / 2FA | 🟢 | 🟢 | 0 | Clerk handles. |

**Sub-total:** ~8 days. **Confidence: 🟢 across both horizons.** RLS has a small first-time learning curve but it's not a real risk.

---

## 3. Data layer (Drizzle schema + migrations)

| Entity | 6-week | 6-month | Notes |
|---|---|---|---|
| Tenant | 🟢 | 🟢 | Trivial. |
| User | 🟢 | 🟢 | Joined to Clerk via `clerk_user_id`. |
| Organization (owner / architect) | 🟢 | 🟢 | Reusable per tenant. |
| Subcontractor | 🟢 | 🟢 | Reusable directory. |
| Project | 🟢 | 🟢 | Owner FK + Architect FK + contract amount. |
| Subcontract | 🟢 | 🟢 | Tricky bit: `current_amount` is derived from original + approved CO deltas. We compute on read OR cache + recompute on CO approval. Likely cache + invalidate. |
| SoVLine (with self-referencing parent_line_id) | 🟢 | 🟢 | Standard tree pattern. Recursive CTE for full tree. |
| ChangeOrder + ChangeOrderLine | 🟢 | 🟢 | Header + lines. Lines reference SoVLines. |
| PayApplication (with direction enum) | 🟢 | 🟢 | One table, two directions (sub→GC, GC→owner). Smart unioning. |
| PayApplicationLine | 🟢 | 🟢 | References SoVLine + carries percentages and computed amounts. |
| SwornStatement | 🟢 | 🟢 | 1:1 with GC→owner PayApp. |
| DocumentAttachment (polymorphic) | 🟢 | 🟢 | `entity_type` + `entity_id` columns. Simple. |
| ApprovalEvent (polymorphic, append-only audit log) | 🟢 | 🟢 | The audit trail. Event sourcing-lite. |
| MagicLink token | 🟢 | 🟢 | Hash stored, raw never. Standard pattern. |

**Schema design total:** ~3 days to design + iterate.
**Initial migration + seed (project-215 fixture):** 1 day.
**Confidence: 🟢 both horizons.**

---

## 4. Core CRUD workflows

| Workflow | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| Tenant + user invite onboarding | 🟢 | 🟢 | 2 | Auth flow + first project setup wizard. |
| Project create + edit | 🟢 | 🟢 | 1.5 | With Owner + Architect lookup or create-new. |
| Subcontractor directory CRUD | 🟢 | 🟢 | 1 | Per-tenant directory. |
| Subcontract create + edit | 🟢 | 🟢 | 2 | Spec sections (text array), inclusions, exclusions, attached signed contract PDF. |
| SoV builder (create top-level lines + breakdowns) | 🟢 | 🟢 | 3 | Hierarchical inline editing. Pattern: drag-drop in v1, inline edit only in MVP. |
| SoV import from contract template | 🟡 | 🟢 | 2 | MVP: paste a CSV. v1: parse a structured Excel. |
| Sub Pay App submission (sub side) | 🟢 | 🟢 | 3 | Form scoped to sub's lines + ceiling validation. Mobile + desktop. |
| GC Pay App review (PM side) | 🟢 | 🟢 | 2 | Same form with override columns + side panel for sub's PDFs. |
| Change Order draft + line items | 🟢 | 🟢 | 2 | Form with line ad/deduct rows. |
| Multi-party approval routing (CO + PayApps) | 🟢 | 🟢 | 3 | State machine reducer + API routes that trigger transitions. |
| **CO auto-propagation logic** ⭐ | 🟢 | 🟢 | 2 | Single transaction: bump Subcontract.current_amount + each affected SoVLine. Tested with property-based tests. |
| GC→Owner PayApp generation (auto-roll up sub PayApps) | 🟢 | 🟢 | 3 | Aggregation logic in domain layer. |
| Sworn Statement generation | 🟢 | 🟢 | 1 | Pulls from approved owner PayApp. |

**Sub-total:** ~27 days for all CRUD workflows.

---

## 5. Domain logic (pure functions, in `packages/domain`)

This is the highest-leverage part of the codebase — gets unit-tested heavily, no UI dependencies, runs the business rules.

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| State machines (4: SubPayApp, OwnerPayApp, ChangeOrder, SwornStatement) | 🟢 | 🟢 | 6 | Discriminated unions + reducers. ~1.5 days each. |
| Invariant checks (7 from data model doc) | 🟢 | 🟢 | 4 | Pure functions called on writes. Each invariant is a one-paragraph spec → ~50-line implementation + tests. |
| CO propagation logic (atomic) | 🟢 | 🟢 | 2 | Transaction + side-effect helper. Property-based tests for "sum of children = parent." |
| PayApp aggregation (sub→GC roll-up) | 🟢 | 🟢 | 2 | Period-bounded query + sum across lines. |
| Retention math | 🟢 | 🟢 | 1 | Standard 10% calc. Closeout release math = phase 2. |
| Drift detection (recompute all invariants for a project) | 🟢 | 🟢 | 2 | Function returns array of violations. Surface as DB query or scheduled job. |

**Sub-total:** ~17 days. This is the most defensible part of the codebase — pure, tested, no chrome.

---

## 6. PDF generation

| Document | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| AIA G702 cover sheet (9-line summary) | 🟡 | 🟢 | 3 | First cut in days; pixel-matching AIA's exact published form takes weeks. We use "AIA-compatible format" branding. |
| AIA G703 continuation sheet (line-item detail) | 🟡 | 🟢 | 2 | Standard line-item table. |
| Sworn Statement (state-specific) | 🟢 | 🟢 | 2 per state | Michigan + Illinois first (Spartan's likely needs); Wisconsin / Indiana / Ohio / others on demand. |
| Subcontract document generation (from template) | 🟡 | 🟢 | 3 | Word-template-style. v1 uses React-PDF; could integrate Pandoc later for Word export. |
| Change Order document with sub backup attached | 🟢 | 🟢 | 1 | Compose CO PDF + attach sub's quote PDF. |

**Stack:** `@react-pdf/renderer` for declarative server-side PDF. Puppeteer reserved for fallback.

**Sub-total:** ~11 days for MVP form set.

**Risk note:** AIA's actual licensed forms cost money and AIA takes a dim view of "AIA-compatible" claims. Sal said "close to AIA is fine." We use the format pattern, not the trademark.

---

## 7. Notifications

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| Email templates (React Email) per state transition | 🟢 | 🟢 | 2 | One template per (entity, transition). ~12 templates total. |
| Magic-link email send (with token URL) | 🟢 | 🟢 | 1 | Resend send + log delivery status. |
| In-app notification feed | 🟢 | 🟢 | 2 | Events table + dashboard activity panel. |
| SMS notifications (twilio) | 🟢 | 🟢 | 2 (phase 2) | Optional — only if customers ask. Subs prefer SMS over email. |
| Slack notifications (per-tenant webhook) | 🟢 | 🟢 | 1 (phase 2) | Some GCs run on Slack; nice-to-have. |
| Push notifications (mobile) | 🟡 | 🟡 | 5 (phase 2/3) | Requires native app or PWA + service workers. Defer. |

**Sub-total (MVP):** ~5 days.

---

## 8. Drift detection (the wedge)

This deserves its own section because it's *the* product differentiator.

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| 7 invariant check functions (in `packages/domain`) | 🟢 | 🟢 | 4 | Each one is a pure function returning `{ violation: bool, details: object }`. |
| On-write validation (block submission) | 🟢 | 🟢 | 1 | Hooks into Server Actions — invariant fails → API returns error with violation details. |
| Async drift scan (recompute all invariants for tenant) | 🟢 | 🟢 | 2 | Scheduled job (Vercel Cron) every hour OR on-demand from dashboard. |
| Drift alerts data model (entity, severity, detected_at, acknowledged_at) | 🟢 | 🟢 | 1 | One table; per-tenant. |
| Drift dashboard surface | 🟢 | 🟢 | 2 | Already designed (Screen 12). |
| Drift detail view + 3 resolution paths | 🟢 | 🟢 | 2 | Already designed. Each path is a Server Action call. |
| Drift history per entity | 🟢 | 🟢 | 1 | Audit log of when it was first detected, fixed, etc. |

**Sub-total:** ~13 days. This is the moat — strong and unique, but easy to build.

---

## 9. Integrations & exports

| Integration | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| QuickBooks CSV export (AP entries, AR entries, journal-ready) | 🟢 | 🟢 | 2 (MVP) | Format Angela can import. Saves her current manual reconciliation step. |
| **QuickBooks Online API** (two-way) | 🔴 | 🟡 | 10–15 (phase 2) | API has rate limits, sync drift, account mapping quirks. v1 reads but doesn't write. v2 full sync. |
| QuickBooks Desktop integration | 🔴 | 🔴 | 30+ (phase 3) | Requires Web Connector (XML SOAP). Painful. Most $5–$50M GCs use QB Online; QB Desktop on demand only. |
| Sage 100 / 300 Construction integration | 🔴 | 🔴 | 30+ (phase 3+) | Vendor-controlled API; cooperation slow. Skip until 5+ Sage-using customers ask. |
| Foundation Software integration | 🔴 | 🔴 | 30+ (phase 3+) | Same story as Sage. |
| Procore data import (for migration of existing projects) | 🔴 | 🔴 | 15 (phase 3) | Procore API exists but read-only on free tier; pull historical projects, map to our schema. |
| DocuSign / Dropbox Sign integration | 🟢 | 🟢 | 3 (phase 2) | SDK is straightforward. Useful for in-app e-sign flows. |
| Slack OAuth + per-tenant webhooks | 🟢 | 🟢 | 2 (phase 2) | Optional, customer-driven. |

**Critical takeaway:** integrations are the "long pole" of any construction product. We commit to QuickBooks first (it's what 95% of SMB GCs use). Everything else is on-demand.

---

## 10. Phase 2 features (planned post-MVP)

| Feature | 6-month | Days | Notes |
|---|---|---|---|
| **AI PDF ingestion** for sub-submitted PDFs | 🟡 | 10 | Claude vision extracts line items, pre-fills the structured form, GC reviews before accepting. Failure modes: handwritten annotations, multi-page tables, sub-template variation, OCR'd-but-unstructured PDFs. Need accuracy logging per-sub to improve over time. |
| **Lien waiver management** (conditional/unconditional, partial/final) | 🟢 | 5 | Generation + tracking. State-specific text varies but layout is straightforward. Levelset (Procore-owned) does this; we compete on price + integration. |
| **Compliance doc tracking** (COIs, W-9s, certified payroll, prevailing wage) | 🟢 | 5 | Document expiration alerts, per-sub per-period uploads. Block sub pay app if COI expired. |
| **Full external accounts** (architects/owners log in instead of magic link) | 🟢 | 5 | Same Clerk infrastructure, expand role matrix. Keep magic-link as fallback for one-off approvers. |
| **WIP report generation** (quarterly GAAP entry) | 🟢 | 5 | Computation: % cost vs % sale per project. Angela's current Excel formalized. |
| **DocuSign integration** | 🟢 | 3 | SDK + status webhook. |
| **Mobile field UI** for % complete entry by PMs | 🟡 | 10 | Portal mobile is fine; full field-PM mobile is more surface area. PWA not native. |
| **Reporting dashboard** (cash flow, project margin, forecast) | 🟢 | 10 | Aggregation queries on existing data. Lots of UI work. |
| **Multi-currency** | 🟡 | 10 | Schema impact across all $ fields. Better to do upfront if planned; expensive retrofit. |
| **Multi-entity** (one tenant runs multiple GC entities) | 🟡 | 10 | Adds entity_id everywhere; non-trivial retrofit. |
| **Custom AIA-style form templates** (per-state, per-customer) | 🟢 | 5 per template | Once base AIA is solid, customer-specific tweaks are config. |
| **Audit log export** (full event history per project) | 🟢 | 2 | Already have ApprovalEvent table; just expose query + CSV/PDF export. |

**Sub-total Phase 2 capacity:** plenty in 6 months if we sequence right. Not all of these need to ship by month 6.

---

## 11. UX / UI work

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| Component library buildout (shadcn extensions) | 🟢 | 🟢 | 3 | As-needed during feature work. |
| Empty states across all screens | 🟡 | 🟢 | 3 | Designed but not fully built in mockups. v1 polish. |
| Loading states / skeleton screens | 🟢 | 🟢 | 2 | Standard pattern. |
| Error states + recovery UX | 🟢 | 🟢 | 2 | Toast + inline errors. |
| Mobile responsive breakpoints | 🟡 | 🟢 | 5 | Portal + magic-link mobile are designed; dashboard mobile = phase 2. |
| Print stylesheets (for AIA forms) | 🟢 | 🟢 | 2 | Critical — AIA forms get printed. |
| Accessibility (WCAG 2.1 AA) | 🟡 | 🟢 | 5 | Pass scan with shadcn (it's accessible by default); detailed audit at v1. |
| Dark mode | 🟢 | 🟢 | 5 (phase 2) | Defer; not asked for. |
| Localization (en-US only at MVP) | 🟢 | 🟢 | 0 | Phase 3 conversation. |

---

## 12. Operational concerns (production-readiness)

| Component | 6-week | 6-month | Days | Notes |
|---|---|---|---|---|
| Monitoring & alerting (Sentry + Vercel Analytics) | 🟢 | 🟢 | 1 | Basic in MVP. |
| Logging strategy | 🟢 | 🟢 | 1 | Structured logs via pino at v1. |
| Database backup + PITR (Neon does this) | 🟢 | 🟢 | 0 | Neon has 7-day PITR built in. |
| Disaster recovery runbook | 🟡 | 🟢 | 2 (phase 2) | Document recovery steps. |
| Customer support workflow (how do we handle tickets?) | 🟡 | 🟢 | 3 (phase 2) | Email + ticket system (Linear/Plain). |
| Onboarding flow for new tenants | 🟡 | 🟢 | 5 | Self-serve sign-up + first-project wizard. MVP can be "we onboard you over Zoom"; v1 self-serve. |
| Billing/subscriptions infrastructure | 🟡 | 🟢 | 5 (phase 2) | Stripe Billing. Pricing TBD ($500–$1200/mo flat per the plan). |
| Usage analytics (PostHog or similar) | 🟢 | 🟢 | 1 | One-line install. |
| **SOC 2 compliance preparation** | 🔴 | 🟡 | n/a | Audit takes 6+ months calendar time, costs $20K+. Plan for SOC 2 Type 1 by month 9–12 if customers demand. Spartan probably won't ask in year 1. |
| Data export (customer can leave with their data) | 🟢 | 🟢 | 2 | All projects → ZIP of CSVs + PDFs. Trust signal. |
| GDPR / data deletion compliance | 🟢 | 🟢 | 2 | Per-tenant nuke endpoint. Standard. |

---

## 13. Risks outside engineering (the honest ones)

These are the things that won't be solved by writing code. Engineering is the easy part.

| Risk | What it means | Mitigation |
|---|---|---|
| **Sub adoption friction** | If subs don't use the portal, GC ends up doing double work. | Phase 2 AI PDF ingest as fallback. Make portal genuinely faster than PDF for subs. Strong onboarding emails. |
| **Distribution / sales** | Construction is referral-driven, not cold-SaaS. Slow buying cycles (4–9 months). Demo-to-deal can be 6 months. | Spartan as design partner first → warm intros. AGC/CFMA association presence. Content/SEO play targeting "AIA pay app software for SMB GC." |
| **QuickBooks integration edge cases** | QB Online API has real quirks (rate limits, sync drift, account mapping). | Start CSV export in MVP. API integration in Phase 2 with conservative scope. Hire someone with QB expertise if we hit a wall. |
| **Edge cases on retention release** | Project closeout retention release is its own workflow with state-specific rules. | MVP handles standard 10% retention. Closeout retention release in Phase 2. |
| **Pixel-perfect AIA forms** | AIA forms have legal/style requirements; we can't claim to be "the AIA form." | Use "AIA-compatible format" language, never claim AIA license. Sal said "close is fine." |
| **Procore competitive response** | If we gain traction, Procore could ship our wedge in a quarter. | Distribution + ICP focus is the moat, not the feature. Procore won't go down-market for SMB. |
| **Existing system migration** | Spartan has 100+ projects in Excel/Cantina/QB. Migrating real history is hard. | MVP is for new projects. Migration tool in Phase 2 if requested. Frame as "Spartan keeps Cantina for closed projects, runs new projects in construct-app." |
| **Customer support scaling** | Construction users tend to call/email rather than search docs. Heavy white-glove early. | First 5 customers get founder-level onboarding. Build self-serve docs as you go. Hire support after customer #10. |
| **Spartan's Matt blocks adoption** | Sal has a partner (Matt) who was hesitant about funding the build. He could block Spartan from being design partner. | Demo to Sal first; let him sell internally. Have a fallback design partner in mind (referrals from Sal). |
| **Compliance / legal (SOC 2, data breaches)** | We'll handle financial data; lower trust until audit. | Lean on Clerk + Neon + Cloudflare's existing certifications in marketing. SOC 2 Type 1 by month 9–12. Cyber insurance day 1. |
| **You're alone** | Solo founder + Claude Opus is fast but creates bus-factor. | Document everything in `packages/domain` (pure logic, easy to onboard a contractor). Plan to hire engineer #2 around month 4–6 if revenue justifies. |

---

## 14. Realistic 6-month outcome

If we run the plan + put in effort on distribution from day one:

**By month 1 (MVP shipped):**
- 9 mockups → working app
- Spartan running 1 project on it
- Confidence in domain layer correctness (high test coverage)

**By month 2:**
- Spartan running all active projects on it
- Iterations from real usage: 5–10 papercuts fixed
- 10 customer-discovery calls done with other GCs in target ICP

**By month 3:**
- 1–2 paying customers (Spartan + 1 referral). $1K–$2K MRR.
- AI PDF ingestion shipped (Phase 2 priority #1)
- QuickBooks API read-only sync shipped

**By month 4–5:**
- 3–5 paying customers. $3K–$5K MRR.
- Lien waivers + compliance docs shipped
- Full external accounts for architects/owners
- Mobile field UI in beta

**By month 6:**
- 5–8 paying customers. $5K–$10K MRR.
- WIP report generation
- DocuSign integration
- Reporting dashboard
- SOC 2 Type 1 audit kickoff if customer demand
- Engineer #2 hired if revenue + roadmap justifies

**Realistic 6-month financial state:** $5K–$10K MRR, 5–8 paying customers, validated PMF, ready for seed round OR another year of bootstrapping.

**What it WON'T look like at 6 months:** $50K MRR, 50 customers, fundraised Series A. Construction sales cycles don't compress that fast.

---

## 15. What we explicitly DON'T promise (be honest in the meeting)

- **Migration of existing project history** from Cantina/Excel — Phase 3 conversation.
- **Replacing the GC's accounting system** — we integrate with QB; we are not QB.
- **Pixel-perfect AIA form fidelity** — we use the format pattern, not licensed AIA forms.
- **Multi-entity support** in MVP — single GC firm tenant only.
- **Real-time field collaboration** (Procore-style multi-cursor) — not on the roadmap.
- **Heavy customization per customer** — we have a config layer, but this is a multi-tenant SaaS, not bespoke software.
- **Same-day support for everything** — we'll do white-glove onboarding for first 5 customers; after that, business-hours email response.

---

## 16. Engineering days summary

```
6-WEEK MVP                                                     ~40 days
─────────────────────────────────────────────────────────────────────────
Foundation & infrastructure                                       7 days
Auth & access control                                             8 days
Data layer (schema + seed)                                        4 days
CRUD workflows (in tools 27 cumulative; trimmed to MVP critical) 22 days
Domain logic (pure)                                              17 days  (overlaps)
PDF generation (AIA + Sworn)                                     11 days
Notifications                                                     5 days
Drift detection                                                  13 days  (overlaps w/ domain)
QB CSV export                                                     2 days
Repo bootstrap, CI, deploy                                        2 days
Spartan dogfooding fixes (week 6)                                 3 days
                                                                ───────
                                                          TOTAL ~40 days  (6 weeks full-time)


PHASE 2 (months 2-6)                                          ~80 days
─────────────────────────────────────────────────────────────────────────
AI PDF ingestion                                                 10 days
QuickBooks API (read-only)                                       10 days
Lien waivers + compliance docs                                   10 days
Full external accounts                                            5 days
WIP report generation                                             5 days
DocuSign integration                                              3 days
Mobile field UI (PWA)                                            10 days
Reporting dashboard                                              10 days
SOC 2 prep (calendar time, not engineer days)                    n/a
Customer support tooling                                          5 days
Self-serve onboarding wizard                                      5 days
Stripe Billing                                                    5 days
Polish, papercuts, dogfooding fixes                              10 days
                                                                ───────
                                                         TOTAL  ~88 days  (~5 months at 4 days/week)
```

**The math works:** 40 days MVP + 88 days Phase 2 = 128 engineering days. At 4 days/week of focused work, that's ~32 weeks = 7.5 months calendar time. Fits the 6-month window if some Phase 2 items push to month 7-8.

---

## 17. Final honest take for the Spartan meeting

**Engineering confidence (6-week MVP):** very high. I've built equivalents of every feature here in similar stacks. No unknown unknowns.

**Engineering confidence (6-month v1):** high. The hard part (the wedge — CO propagation + drift detection) is also the smallest, cleanest part of the codebase. The long tail of polish and integrations is well-bounded.

**What can derail us:** distribution / customer acquisition. Construction is slow to buy. Spartan as design partner solves the first customer; getting to customer #2-#10 is real work.

**What I'd want to hear from Spartan to feel confident:**
1. They commit to actually using it (not just looking).
2. They'll give us 2–3 warm intros to other GCs after they're live.
3. They'll let us name them as a design partner publicly.

If they say yes to those three, we're off to the races. If they say no, build it anyway and find another design partner — the engineering thesis is sound.
