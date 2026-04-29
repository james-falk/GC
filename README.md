# constructor

GC middleware — a multi-tenant SaaS managing the monthly pay-app cycle, change orders, schedule of values, subcontract administration, and reconciliation across subcontractors, internal teams, architects, and owners.

## Status

Early build. MVP target: 6 weeks.

## Documentation

All design and decision docs live in [`docs/`](./docs):

- [`gc-data-model.md`](./docs/gc-data-model.md) — 13 entities, 7 invariants
- [`gc-state-machines.md`](./docs/gc-state-machines.md) — 4 state machines (Sub Pay App, Owner Pay App, Change Order, Sworn Statement)
- [`gc-seed-data.md`](./docs/gc-seed-data.md) — anonymized project-215 fixture
- [`gc-feasibility.md`](./docs/gc-feasibility.md) — confidence levels for MVP and 6-month v1
- [`gc-wireframes-brief.md`](./docs/gc-wireframes-brief.md) — UI screen specs
- [`gc-one-pager.html`](./docs/gc-one-pager.html) — customer-facing product summary

Project conventions: [`CLAUDE.md`](./CLAUDE.md). Read before contributing or pair-programming with AI.

## Repo layout

```
constructor/
├── apps/
│   └── web/              # Next.js 15 app (App Router, server actions)
├── packages/
│   ├── db/               # Drizzle schema + migrations + seed
│   ├── domain/           # Pure business logic (state machines, invariants, CO propagation)
│   ├── pdf/              # @react-pdf/renderer document generation
│   └── ui/               # Shared shadcn-based components
├── docs/                 # Design + decision documentation
├── .github/workflows/    # CI: lint, typecheck, unit tests
└── CLAUDE.md             # Project conventions
```

## Tech stack

- **Runtime/framework:** Next.js 15 (App Router) + React 19 + TypeScript 5
- **Package manager:** pnpm 9 monorepo
- **Database:** PostgreSQL via Neon (serverless, branching for dev/staging)
- **ORM:** Drizzle ORM (migrations only — never `push` to dev/prod)
- **Auth:** Clerk (multi-tenant orgs + magic-link external approvers)
- **UI:** Tailwind v4 + shadcn/ui
- **Forms:** react-hook-form + zod
- **State machines:** hand-rolled discriminated unions + reducers (no XState)
- **PDF:** @react-pdf/renderer (server-side)
- **File storage:** Cloudflare R2 (S3-compatible)
- **Email:** Resend + react-email
- **Testing:** Vitest (unit) + Playwright (e2e)
- **Hosting:** Vercel
- **Observability:** Sentry

## Quickstart

```bash
# install
pnpm install

# run web app
pnpm dev

# run all tests
pnpm test

# typecheck across the workspace
pnpm typecheck

# database
pnpm db:generate     # generate migration from schema changes
pnpm db:migrate      # apply migrations to DATABASE_URL
pnpm db:seed         # load anonymized project-215 fixture
```

## Build sequencing rules

To prevent the AI-codebase mess explicitly:

1. **Domain before UI, every feature** — schema → pure-function domain logic → unit tests → UI. Never the reverse.
2. **One feature complete before the next.** Definition of complete: schema migrated, domain unit-tested, server actions working, UI matches wireframe, e2e happy path passes.
3. **Wireframe-locked UI.** UI exactly implements the Paper wireframe. Deviations require updating the wireframe first.
4. **Friday hygiene hour, every Friday** — read the diff, delete dead code, unify drifting patterns, update `CLAUDE.md`.
5. **Seeded test data is sacred.** If a feature works against the project-215 seed, it works.

See [`CLAUDE.md`](./CLAUDE.md) for the full convention set.
