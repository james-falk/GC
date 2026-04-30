# constructor — project conventions

This file is read into every Claude Code session that opens this repo. It overlays the user-level `~/.claude/CLAUDE.md` (terse, anti-mess, Whimsical-not-Mermaid, etc.).

## Current build state — read first

**Day 1 of MVP build COMPLETE** (2026-04-29). End-to-end Clerk → tenants sync verified on production (Vercel + Neon). Day 2 about to start.

Single source of truth for current build state: [`docs/BUILD-STATUS.md`](./docs/BUILD-STATUS.md). **Read that before doing anything in code.**

Key facts:
- Repo: `https://github.com/james-falk/GC`. Local: this directory.
- Production deploy: `https://gc-web-pink.vercel.app`.
- Project codename: **constructor**. Root npm package: `gc-monorepo` (not `constructor` — that name is a JS reserved word and breaks pnpm). Sub-package scope: `@constructor/*` (this works fine because scoped names don't hit `Object.prototype`).
- Two Drizzle migrations applied to Neon (`tenants` table with `clerk_org_id`).
- Clerk webhook handler at `apps/web/src/app/api/webhooks/clerk/route.ts` — handles `organization.*` events, signature-verified via svix.
- Env vars wired both locally (`apps/web/.env.local`) and on Vercel (Production + Preview + Development).

## What this project is

A multi-tenant SaaS for SMB commercial general contractors ($5M–$50M revenue, QuickBooks-using), targeting the GC-middle pay-app workflow: subs submit pay apps to the GC, GC submits AIA G702/G703 pay apps to owners, change orders auto-propagate to both sides. The wedge is **bi-directional CO propagation with drift detection** — no incumbent does it cleanly.

Source-of-truth plan: `C:\Users\james\.claude\plans\okay-we-need-to-floofy-hearth.md`. Read that first if context is missing.

Reference docs in this repo:
- `gc-wireframes-brief.md` — Paper-ready screen specs (12 screens)
- `gc-data-model.md` — entities, relationships, invariants
- `gc-state-machines.md` — PayApp / ChangeOrder / SwornStatement state machines
- `gc-seed-data.md` — anonymized project-215 fixture spec

## Tech stack (locked — see plan file for rationale)

- Next.js 15 (App Router) + React 19 + TypeScript 5.x + pnpm 9
- pnpm monorepo: `apps/web`, `packages/db`, `packages/domain`, `packages/pdf`, `packages/ui`
- PostgreSQL 16 via Neon (project `construct-app` already provisioned, `sweet-darkness-04058732` in us-east-1)
- Drizzle ORM 0.36+ — migrations only, never `push` to dev/prod
- Clerk for auth + multi-tenant orgs
- Tailwind v4 + shadcn/ui
- react-hook-form + zod
- Hand-rolled state machines (discriminated unions + reducers, no XState)
- `@react-pdf/renderer` for AIA G702/G703 + sworn statements
- Cloudflare R2 for file storage (S3-compatible)
- Resend + react-email
- Vitest + Playwright
- Vercel for hosting, Sentry for errors

## Non-goals (deliberately out)

No microservices. No GraphQL. No Redux/Zustand. No Auth.js (Clerk only). No Storybook initially. No Kubernetes. No microfrontends.

## Code-quality guardrails (these are not negotiable)

1. **Domain logic is pure.** `packages/domain` holds all business logic — state machines, invariants, CO propagation, retention math, drift checks — as pure functions with unit tests. UI never reimplements domain logic.
2. **No `any`.** ESLint strict mode. The only exception is third-party types we can't fix; each instance is commented with WHY.
3. **No premature abstractions.** Three similar lines is better than a wrong helper. Helpers earn their existence by being needed three+ times.
4. **No silent fallbacks.** If something can't happen, throw. Don't swallow errors with `??` defaults that hide bugs. Validate at boundaries (user input, external APIs); trust internal types.
5. **Drizzle is the schema source of truth.** Schema changes go through migrations (`drizzle-kit generate`). No `push` to dev/prod. Never edit a migration after it's run anywhere.
6. **Server-first.** Default to Server Components. `"use client"` only when an interaction genuinely needs it.
7. **One Friday hour, every Friday.** Read the diff since last Friday. Delete dead code. Unify drifting patterns. Update this file with any new conventions.
8. **PRs require:** lint pass, typecheck pass, unit tests pass, no `any` added, no `TODO` left without an issue. CI enforces.
9. **Tests as guardrails, not totems.** Domain layer = high coverage. UI = thin smoke tests. E2E = the three critical happy paths only (sub submit → GC approve → AIA PDF generated; CO created → architect approves → owner approves → propagation; drift introduced → drift dashboard surfaces it).

## Build sequencing rules

To prevent the AI-codebase mess we explicitly want to avoid:

- **Domain before UI, every feature.** For each MVP feature: write the schema, write the pure-function domain logic, write unit tests, *then* build the UI. Never the reverse.
- **One feature complete before the next.** Definition of complete: schema migrated, domain unit-tested, server actions working, UI matches wireframe, e2e happy path passes. No partial features bleeding into next week.
- **Wireframe-locked UI.** UI exactly implements the Paper wireframe for that screen. Deviations require updating the wireframe first. Stops AI-invented UI drift.
- **Seeded test data is sacred.** If a feature works against project-215 seed (`gc-seed-data.md`), it works.

## Communication style (in addition to user-level)

- When asked to implement something, restate the spec in one sentence before coding so we catch misunderstandings early.
- After changes, list which files changed and why, not what they do (the diff says what).
- Don't write planning docs (`*.md`) unless asked. Conversation-state lives in the conversation, not files.
- Don't add comments explaining recently-fixed bugs ("// fix for X") — that belongs in the commit message.

## Repo state

Working directory: `c:\Users\james\OneDrive\Desktop\git\GC` (currently empty / non-git — Day 4 of Week 0 will `git init` and scaffold the Next.js app).

Until then: only markdown planning docs in this directory.

## Naming

Project working name: **construct-app**. Will likely rename before public launch — keep the name out of generated branding (logos, headers) until we lock it.
