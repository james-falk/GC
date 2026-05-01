# Build Status

Running log of where the build is. Updated on every meaningful checkpoint.

---

## 2026-04-29 — Day 1 of MVP build: COMPLETE

End-to-end Clerk org → tenants sync verified working in production (Vercel + Neon).

### Shipped this session

| Step | Commit |
|---|---|
| Initial scaffold + planning docs in `docs/` | `c2ccf92` |
| Next.js 15 app, Drizzle config, package tsconfigs | `093e27f` |
| Fix pnpm "constructor" reserved-word collision (rename root → `gc-monorepo`); add lockfile | `eb21f96` |
| Make pnpm typecheck pass across all 5 workspaces | `4a34a42` |
| Fix Next.js dev warnings (`typedRoutes`, `outputFileTracingRoot`) | (next) |
| First migration: `tenants` table on Neon | (next) |
| Wire Clerk auth into apps/web (ClerkProvider + middleware + sign-in/up UI) | (next) |
| Migration #2: add `clerk_org_id` to tenants | (next) |
| Webhook handler `/api/webhooks/clerk` (svix verify, organization.* sync) | (next) |
| Add `query-tenants.ts` debug utility | (next) |

### What works right now

- **Repo:** [`james-falk/GC`](https://github.com/james-falk/GC) — private, on `main` only.
- **Local:** `c:\Users\james\OneDrive\Desktop\git\GC` — full pnpm monorepo, lockfile committed.
- **Workspaces:** `apps/web`, `packages/db`, `packages/domain`, `packages/pdf`, `packages/ui`. Domain/pdf/ui have stub `src/index.ts` files (`export {};`) until real code lands. `packages/db` has full Drizzle setup + first entity (`tenants`).
- **Production deploy:** [`gc-web-pink.vercel.app`](https://gc-web-pink.vercel.app) — auto-deploys on push to `main`.
- **CI:** GitHub Actions running lint + typecheck + test on every PR + push to main. Passes since lockfile commit.
- **Database:** Neon project `construct-app` (us-east-1, Postgres 17). Two migrations applied:
  - `0000_friendly_wild_child` — created `tenants` table.
  - `0001_smiling_peter_quill` — added `clerk_org_id` column (NOT NULL, UNIQUE).
- **Auth:** Clerk dev instance wired. ClerkProvider in layout, `clerkMiddleware` in middleware, sign-in/up modal buttons on home page. Organizations enabled in Clerk dashboard.
- **Webhook:** `/api/webhooks/clerk` verifies svix signature, handles `organization.created/updated/deleted`. **End-to-end test: Clerk dashboard "Send Example" → 200 OK → row appeared in `tenants` (Acme Corp, `org_2g7np7Hrk0SN6kj5EDMLDaKNL0S`).**

### Env vars (DO NOT commit)

Local `apps/web/.env.local` has all of:
- `DATABASE_URL` (Neon pooled)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- placeholders for R2, Resend, Sentry

Vercel has the same set on Production + Preview + Development.

`.env.local` is gitignored. Never commit.

### MCP servers configured (user scope)

vercel, sentry, cloudflare, github, neon, clerk, paper (local), whimsical (local). Neon token expires between sessions — re-auth via `/mcp` when needed. For ad-hoc DB queries without MCP, use the `query-tenants.ts` script pattern.

### Lessons burned in (avoid relearning)

1. **`"constructor"` as root npm package name collides with `Object.prototype.constructor`** in pnpm workspace resolution. Reproduces on pnpm 9.15.0/9.15.4/10.4.1. Root is now `gc-monorepo`. Scoped sub-packages (`@constructor/*`) are fine.
2. **drizzle-kit's CJS loader** doesn't auto-resolve `.js` → `.ts` extensions. Drop file extensions in schema imports.
3. **Stub-package boilerplate** (`main`/`types`/`exports` pointing at not-yet-existing files) breaks pnpm install. Add those fields when there's actual source code.
4. **Vercel env-var changes require redeploy** — they don't apply to existing deployments.
5. **`gh` CLI on this machine is authenticated as `kerrybros`, not `james-falk`**. `git push` to `james-falk/*` works via Git Credential Manager (separate creds), but `gh repo create james-falk/...` etc. needs the personal-account auth added separately.

---

## 2026-04-30 — Day 2: COMPLETE, Day 3 Phase A: COMPLETE

Day 2 and Day 3 Phase A shipped in the same calendar day.

### Day 2 — what shipped

| Step | Commit |
|---|---|
| 14 remaining Drizzle entities + migration `0002` | `1a5655a` |
| Make `users.role` nullable + migration `0003` | (same) |
| Verification script `packages/db/src/scripts/list-tables.ts` | (same) |
| Clerk `user.*` webhook → `users` sync | `84a581d` |
| Domain scaffolding: 4 state-machine type modules + `checkSubBillableCeiling` invariant + 7 vitest tests | `50b8d61` |
| Fix CI pnpm version mismatch + workspace lint/test stubs | `c7a670f` |

### Day 3 Phase A — what shipped

First user-visible feature work. The site is no longer a one-page landing.

| Step | Commit |
|---|---|
| Authenticated route group + app shell (top bar + sidebar nav) | `9ddedb4` |
| `/projects` list page (Server Component, tenant-scoped) | (same) |
| `/projects/new` form + zod-validated server action | (same) |
| `/projects/[id]` stub (real header, tab nav, SoV placeholder) | (same) |
| `getCurrentTenant()` server helper (Clerk org → tenants row) | (same) |
| Root page redirects signed-in users to `/projects` | (same) |
| Fix post-sign-in modal redirect via `fallbackRedirectUrl` | `9ea2ad6` |

### State of the site (as of this writing)

Local dev: signing in works. Empty-state CTA → /projects/new → form → submit → /projects/[id]. Sidebar shows 8 nav items; only Projects is wired, the rest are visibly disabled.

**Vercel is rate-limited** (Hobby tier daily cap hit by burst pushes during Day 1 + Day 2). Today's commits are on origin/main + green CI but haven't deployed. Latest production deploy is yesterday's `49a090b`. Limit clears on a 24h rolling window — should recover overnight, or upgrade to Pro to remove the cap.

### Lessons burned in (Day 2 + Day 3A)

6. **Postgres truncates FK constraint names at 63 bytes.** Drizzle generates names like `subcontracts_signed_contract_attachment_id_document_attachments_id_fk` which trigger NOTICEs and get silently truncated. Non-fatal, but if you ever search the catalog by exact name, know that the on-disk name may be shorter than the migration SQL.
7. **`pay_app_status` is a union enum** of SubPayApp + OwnerPayApp states. The valid set per row is determined by `direction` and enforced in the domain layer — the DB doesn't constrain it.
8. **Clerk modal sign-in (`mode="modal"`) doesn't trigger a full page navigation,** so server-side `redirect()` based on `auth().userId` won't fire. Use `fallbackRedirectUrl` on `SignInButton`/`SignUpButton` to route the user explicitly after the modal closes.
9. **CI was red from Day 1 → Day 2 morning** — `pnpm/action-setup@v4` was hardcoded to 9.15.0 while `package.json` declared `pnpm@10.4.1`. BUILD-STATUS earlier claimed CI was passing; that was wrong. Fixed in `c7a670f`. Lesson: **don't trust BUILD-STATUS claims about CI without verifying with `gh run list`.**
10. **Vercel Hobby tier rate-limits aggressive pushes.** Burst-pushing 4–5 commits per session will hit the daily/hourly cap and silently stop deploying. Either batch commits before pushing or upgrade to Pro for an intensive build.

---

## 2026-04-30 (cont.) — Day 3 B/C + Day 4: COMPLETE

Continuing the same calendar day. Pattern emerged: **clickable mocks first, real persistence second.** Each new screen renders with realistic seed-shaped data so Spartan can react to the workflow shape; DB persistence + state-machine reducers come on Day 5+.

### Day 3 Phase B — what shipped (commit `30e8e4f`)

- New `[id]/layout.tsx` — fetches project once, wraps every tab with shared header + tab nav.
- `[id]/page.tsx` is the SoV editor (default tab): table + sticky totals + "Add line" form. Server action with zod validation, `revalidatePath` after insert.
- `[id]/_components/project-tabs.tsx` — client component, `usePathname` for active state.
- Subs and Documents tabs as informative placeholders.

### Day 3 Phase C — what shipped (commit `fa0e9ca`)

- Public route at `/sub-pay-app/[token]` (no Clerk auth — magic-link entry).
- Mobile-first single-column form (Screen 6). Real ceiling-check visual when over contract; sticky footer with totals + Net to invoice.
- Mock data shaped on seed fixture (Brothers & Bricks, project 215, March 2026, 5 SoV lines).
- Save draft + Submit rendered but disabled with visible note.

### Day 4 — what shipped (commit `0ab1d3e`)

- **Screen 8 — Change Order creation** at `/projects/[id]/change-orders/new`:
  - Two-column desktop: form (60%) + approval trail (40%).
  - Form: CO number, sub dropdown (rescopes line options), description, dynamic line items table with add/remove, color-coded total impact, justification.
  - Trail: vertical timeline visualizing Principal → Architect → Owner → Auto-propagated. Shows "Created" complete with rest pending.
  - Mock data inspired by seed CO 215-CO-001 (B&B brick wall extension, +$34,700).
- **Screen 7 — GC pay-app review** at `/projects/[id]/pay-apps/[payAppId]`:
  - List view shows mocked submitted sub pay app with status badge.
  - Review screen: line table with Sub % (locked) alongside GC adjusted % (editable, defaults to sub-reported). Reduce → row goes amber with "Reduced from X%" annotation; raise → blue. This period $ recomputes live.
  - Footer summary: total this period / retention (10%) / net to approve.
  - Mock data: seed sub pay app from B&B March 2026 (5 lines).

### State of the site

Local dev (Clerk dev mode) works end to end. Click paths Spartan can walk:
- Sign in → /projects → create project → /projects/[id] (SoV editor)
- Project tabs: SoV, Subs (placeholder), Pay Apps (mocked submission → review screen), Change Orders (empty state → draft form), Documents (placeholder)
- `/sub-pay-app/anytoken` — sub portal mock (mobile-first)

**Vercel is still rate-limited** as of 2026-04-30 evening. All new commits (Day 3 B/C, Day 4) are local-only. Pushing waits until the limit clears (or Pro upgrade) and the user is ready to demo.

### Lessons burned in (Day 3 B/C + Day 4)

11. **`(authenticated)` route group does not protect routes by URL** — Clerk middleware does. The route group only shares a layout; the protection is configured in `middleware.ts` via `createRouteMatcher`.
12. **Public routes for magic-link entry** (e.g., `/sub-pay-app/...`) live OUTSIDE `(authenticated)` and are NOT in the protected matcher. This is the right shape for sub/architect/owner external access.
13. **Clickable-mock pattern works well for Spartan-style review:** build the screen with seed-shaped mock data, real form interactions (computed totals, dynamic rows), buttons rendered-but-disabled with a visible "wired in a later session" note. This makes the workflow shape concrete without burning time on persistence prematurely.

---

## 2026-04-30 (cont.) — Day 5 + Day 6: COMPLETE

All clickable surfaces from the wireframe brief are now built (mostly as clickable mocks against seed-shaped data; the SoV editor and project CRUD are real).

### Day 5 — what shipped

| Phase | Commit | What |
|---|---|---|
| 5A | `b620adc` | Drift Dashboard list + detail (Screens 2 stat card + 12). Three example alerts shaped on the seed: sub-above-ceiling, CO-not-propagated, pay-app-rollup-mismatch. Sidebar nav has red badge for high-severity count. |
| 5C | `e984500` | AIA G702 cover sheet PDF generation, end-to-end. `packages/pdf` ships `@react-pdf/renderer` + `AiaG702` component. API route `/api/aia-pay-app/[payAppId]` returns real PDF. Screen 9 preview at `/projects/[id]/pay-apps/aia` with iframe + metadata sidebar + status flow + working Download button. |

5B (atomic CO propagation backend) was deliberately deferred — needs real data flowing, blocked on subcontract persistence.

### Day 6 — what shipped

| Phase | Commit | What |
|---|---|---|
| 6A | `c9c1ae5` | Sworn Statement PDF + Screen 10 preview. `SwornStatement` component in `packages/pdf` with credible affidavit layout (subs table, signature blocks, notarization block). API route `/api/sworn-statement/[id]`. Preview page mirrors the AIA preview shape. |
| 6B+C | `0741bdf` | External magic-link approval (Screen 11) at public route `/approve/[token]` — Stripe-style minimalism, embedded PDF, Approve/Request Changes with client-side success state. Document Vault (Documents tab) replaces placeholder with real list view, type chips, drag-drop zone, 8 mocked entries. Subs tab (dogfood) replaced with mocked list of 8 subs from seed. |

### State of the site (live in production)

**All 9 commits pushed to `origin/main` and deployed to [`gc-web-pink.vercel.app`](https://gc-web-pink.vercel.app)** (Vercel rate limit cleared). Latest deploy: `dpl_9Z5Gjq2F49LHg4QkKFxF9sJJecP1` for SHA `0741bdf`. CI green ([run 25199398286](https://github.com/james-falk/GC/actions/runs/25199398286)).

Spartan-walkable click paths:
- **GC side** (auth): /projects → create → SoV editor (real, persists) → 5 tabs all show real-feeling content. Drift Alerts in sidebar with 2 high-severity badge.
- **Sub side**: `/sub-pay-app/anytoken` (mobile portal mock).
- **External approver**: `/approve/anytoken` (Stripe-style, embeds AIA PDF).
- **Real PDFs**: AIA G702 + Sworn Statement download server-rendered from `/api/...` routes.

### Lessons burned in (Day 5 + Day 6)

14. **Node `Buffer` ≠ `BodyInit`.** `@react-pdf/renderer`'s `renderToBuffer` returns a Node Buffer; wrap in `new Uint8Array(buffer)` before passing to `NextResponse` or TS rejects it.
15. **API routes that return JSX-rendered content must be `.tsx`, not `.ts`.** PDF generation routes use `<AiaG702 data={...} />` syntax.
16. **`packages/pdf` needs `"jsx": "react-jsx"` in tsconfig** — it doesn't extend the apps/web tsconfig and the base tsconfig is JSX-free.

---

## 2026-05-01 — Backend persistence pass: STARTED

After Day 6, kicked off the post-MVP backend pass — converting clickable mocks into real persistence. **Bottom of the dependency chain first: subcontractors → subcontracts → SoV linkage → CO real data → pay-app real data.**

User decisions captured:
- **No demo data seeding** — every tenant starts empty; users populate via the UI.
- **Minimal fields, expand later** — avoid over-building; add detail when Spartan asks for it.
- **Push only on explicit instruction** — local commits as checkpoints, push when ready to demo.

### What shipped (commit at HEAD)

**Subcontractors top-level** (`/subcontractors`):
- `apps/web/src/app/(authenticated)/subcontractors/page.tsx` — tenant-scoped list with name / email / phone / address columns. Empty state CTA.
- `apps/web/src/app/(authenticated)/subcontractors/new/page.tsx` — minimal create form (only `name` required; email/phone/address optional).
- `apps/web/src/app/(authenticated)/subcontractors/actions.ts` — zod-validated `createSubcontractor` server action.
- `apps/web/src/app/(authenticated)/layout.tsx` — Subcontractors sidebar nav item enabled.

Schema is unchanged — uses the existing `subcontractors` table from migration `0002`. Empty-string-to-undefined coercion in zod so optional fields with empty inputs don't fail validation.

### What's NOT YET DONE in this pass — pickup point

1. **Per-project Subs tab — real data.** `apps/web/src/app/(authenticated)/projects/[id]/subs/page.tsx` is currently a mocked list (8 hardcoded subs from the seed fixture). Replace with a tenant-scoped query that joins `subcontracts` to `subcontractors` for the current project. Show real billed-to-date and CO impact (both will be $0 until pay apps and COs persist).
2. **"Add subcontract" form on the Subs tab.** New route `/projects/[id]/subs/new` (or inline modal). Fields: subcontractor (dropdown reading from directory), contract number, original amount, status. Defer spec sections, inclusions, exclusions, signed-contract attachment per "minimal fields" decision.
3. **SoV editor's add-line form gets an optional subcontract dropdown.** `apps/web/src/app/(authenticated)/projects/[id]/page.tsx` add-line form currently has line #, description, contract amount. Add an optional subcontract picker so each SoV line can be associated with a real subcontract.
4. **CO form's subcontract dropdown reads from real data.** `apps/web/src/app/(authenticated)/projects/[id]/change-orders/new/page.tsx` currently passes hardcoded mock `subOptions` to the `COForm` client component. Replace with a query against real subcontracts for the project.

After step 4, real CO drafts can persist (next sub-step of the backend pass — the state-machine reducer + atomic propagation transaction).

### Pickup-point summary for the next session

Continue the backend pass at step 1 above (per-project Subs tab → real data). The Subcontractors directory at `/subcontractors` is shipped; users can already add directory entries that the next step will consume. Typecheck was clean at the time of this checkpoint.

---

## What comes after the backend pass (rough sketch)

- **Pay-application real persistence** (sub portal real submit, GC review real approval).
- **Magic-link verification** (real flow at `/approve/[token]` and `/sub-pay-app/[token]` instead of mocks).
- **Atomic CO propagation transaction** (the wedge feature working real).
- **R2 file uploads** replacing Document Vault mock.
- **Resend email** for magic-link delivery + pay-app notifications.
- **Sentry** for production error tracking.
- **Real drift detection** running pure-function invariants against live data on a schedule + write-time.

Reference [`~/.claude/plans/okay-we-need-to-floofy-hearth.md`](file:///C:/Users/james/.claude/plans/okay-we-need-to-floofy-hearth.md) § "Build Approach + Timeline" for the original 6-week MVP schedule.
