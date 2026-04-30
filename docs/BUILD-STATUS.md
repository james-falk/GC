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

## Day 2 — NEXT (not yet started)

Sequence:

1. **Drizzle schema for the remaining 14 entities** in one migration:
   - `users`, `organizations` (owners + architects), `subcontractors`, `projects`, `subcontracts`, `sov_lines` (with self-referencing `parent_line_id`), `change_orders`, `change_order_lines`, `pay_applications` (with `direction` enum), `pay_application_lines`, `sworn_statements`, `document_attachments` (polymorphic), `approval_events` (polymorphic, append-only), `magic_links`.
   - Reference: [`gc-data-model.md`](./gc-data-model.md) for exact fields, types, relationships, invariants.
   - Generate migration `0002_*`, apply to Neon, verify with `query-tenants.ts`-style script.
2. **User sync webhook** — extend `/api/webhooks/clerk` to handle `user.created/updated/deleted` → `users` table. Reuses the same svix verification.
3. **`packages/domain` scaffolding** — pure TypeScript types and one invariant function:
   - State machine type definitions (discriminated unions) for SubPayApp, OwnerPayApp, ChangeOrder, SwornStatement. Reference: [`gc-state-machines.md`](./gc-state-machines.md).
   - First invariant function (`subBillableCeiling`) implemented as pure function with Vitest property-based test.
   - Reference: [`gc-data-model.md`](./gc-data-model.md) § Invariants.

### Day 2 entry point for next session

Open `packages/db/src/schema/tenant.ts` for the entity pattern. Each remaining entity follows the same shape (one file per entity, exported from `schema/index.ts`). Generate migration with `pnpm db:generate`, apply with `pnpm db:migrate`, verify with the query-tenants pattern.

---

## Days 3–6 (per plan file)

Reference [`~/.claude/plans/okay-we-need-to-floofy-hearth.md`](file:///C:/Users/james/.claude/plans/okay-we-need-to-floofy-hearth.md) § "Build Approach + Timeline" for the full week-by-week schedule. High-level:

- **Day 3:** SoV editor + sub pay-app portal foundations
- **Day 4:** GC pay-app review + change order creation
- **Day 5:** CO propagation (atomic) + drift detection invariants + AIA G702/G703 PDF generation
- **Day 6:** Sworn statement + magic-link approvals + document vault + dogfooding fixes
