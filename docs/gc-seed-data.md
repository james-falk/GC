# construct-app — Seed Data Spec (Project 215, Anonymized)

Specification for the seed fixture used during build and development. **All values anonymized** — does not require Spartan NDA. Inspired by the project-215 transcript shape, but specific names, dollar amounts, and addresses are fictional.

When we hit Day 5 of Week 0, this spec becomes the source for `seed/project-215.ts`.

---

## Tenant

```
id: <uuid>
name: "Acme Construction Group"
slug: "acme-construction"
```

---

## Users (internal)

| Role | Display name | Email |
|---|---|---|
| principal | Sam Rivera | sam@acme-construction.example |
| principal | Marcus Chen | marcus@acme-construction.example |
| finance | Diana Park | diana@acme-construction.example |
| pm | Lena Torres | lena@acme-construction.example |
| pm | Jordan Wells | jordan@acme-construction.example |
| assistant | Riley Kim | riley@acme-construction.example |

---

## Organizations

### Owner

```
name: "Springfield Public Schools"
type: owner
contact_email: capital-projects@springfield-schools.example
```

### Architect

```
name: "Northbridge Architecture & Design"
type: architect
contact_email: pm@northbridge-arch.example
```

---

## Project

```
project_number: "215"
name: "Lincoln Elementary Renovation Phase 2"
owner_id: <Springfield Public Schools id>
architect_id: <Northbridge Architecture & Design id>
original_contract_amount: $1,872,000.00
status: active
start_date: 2026-01-15
target_completion_date: 2026-09-30
```

---

## Subcontractors (directory entries, all referenced by Project 215)

| Name | Trade | Contact email |
|---|---|---|
| Cascade Demo & Site Services | Demolition / site work | ops@cascade-demo.example |
| Brothers & Bricks Masonry | Masonry | jobs@brothersandbricks.example |
| Apex Electric Co. | Electrical | bid@apex-electric.example |
| Northern Mechanical Systems | HVAC | estimating@northern-mech.example |
| Riverside Plumbing | Plumbing | quotes@riverside-plumbing.example |
| Stoneline Drywall & Paint | Drywall, paint | jobs@stoneline.example |
| Coastal Roofing | Roofing | bid@coastal-roofing.example |
| Premier Flooring Solutions | Flooring | quotes@premier-flooring.example |

---

## Subcontracts (project_id = 215)

| Subcontractor | Contract # | Original $ | Spec sections |
|---|---|---|---|
| Cascade Demo & Site Services | 215-001 | $19,000.00 | 02 41 00 — Demolition |
| Brothers & Bricks Masonry | 215-002 | **$576,622.00** | 04 22 00 — Concrete Unit Masonry; 04 05 13 — Masonry Mortaring; 04 05 16 — Masonry Grouting |
| Apex Electric Co. | 215-003 | $182,400.00 | 26 05 00 — Common Work Results for Electrical |
| Northern Mechanical Systems | 215-004 | $241,000.00 | 23 05 00 — Common HVAC Materials |
| Riverside Plumbing | 215-005 | $97,500.00 | 22 05 00 — Common Plumbing Materials |
| Stoneline Drywall & Paint | 215-006 | $128,800.00 | 09 21 16 — Gypsum Board Assemblies; 09 91 23 — Interior Painting |
| Coastal Roofing | 215-007 | $156,750.00 | 07 50 00 — Membrane Roofing |
| Premier Flooring Solutions | 215-008 | $84,200.00 | 09 65 00 — Resilient Flooring |

**Sum of subcontracts:** $1,486,272.00

**GC-internal cost lines (no subcontract):**
- Bonding: $18,720.00
- Building permits: $9,500.00
- Fire marshal review: $1,800.00
- Dumpsters & temporary site facilities: $14,200.00
- Pre-construction estimating + buyout (16% allocation): $341,508.00 (inferred from `(original_contract - sum_of_subs - other_internal) × 16%` pattern)

---

## Schedule of Values

Pattern: top-level lines numbered 1, 2, 3, ...; large subs broken down into sub-lines (3a, 3b, 3c).

| Line # | Description | Subcontract | Contract $ |
|---|---|---|---|
| 1 | Demolition & site preparation | Cascade Demo | $19,000.00 |
| 2 | Bonding & permits | (GC-internal) | $30,020.00 |
| **3** | **Masonry (parent)** | Brothers & Bricks | **$576,622.00** |
| 3a | — Stone & block delivery | Brothers & Bricks | $98,400.00 |
| 3b | — Masonry labor | Brothers & Bricks | $312,800.00 |
| 3c | — Mortar & grout materials | Brothers & Bricks | $87,200.00 |
| 3d | — Stored materials staging | Brothers & Bricks | $48,222.00 |
| 3e | — Closeout & cleanup | Brothers & Bricks | $30,000.00 |
| 4 | Electrical | Apex Electric | $182,400.00 |
| 5 | HVAC | Northern Mechanical | $241,000.00 |
| 6 | Plumbing | Riverside Plumbing | $97,500.00 |
| 7 | Drywall & paint | Stoneline | $128,800.00 |
| 8 | Roofing | Coastal Roofing | $156,750.00 |
| 9 | Flooring | Premier Flooring | $84,200.00 |
| 10 | Pre-construction & overhead | (GC-internal) | $341,508.00 |
| 11 | Temporary facilities | (GC-internal) | $14,200.00 |

**Total:** $1,872,000.00 = `project.original_contract_amount` ✓

---

## In-flight Change Order

Mid-cycle CO to seed the propagation flow:

```
co_number: "215-CO-001"
description: "Brick wall extension at south entrance — owner-requested scope addition"
affected_subcontract: 215-002 (Brothers & Bricks)
status: pending_owner   (architect already approved)

ChangeOrderLines:
  - sov_line: 3a (Stone & block delivery), delta: +$8,400, reason: "Additional stone for extended wall"
  - sov_line: 3b (Masonry labor), delta: +$24,200, reason: "Labor for ~80 ft of additional wall"
  - sov_line: 3c (Mortar & grout), delta: +$2,100, reason: "Additional mortar"

total_amount: +$34,700.00
```

When this CO transitions to `approved` (in a Week 1+ test scenario), expected propagation:
- `Subcontracts[215-002].current_amount`: $576,622.00 → **$611,322.00**
- `SoVLines[3].current_amount` (parent): $576,622.00 → **$611,322.00**
- `SoVLines[3a].current_amount`: $98,400 → **$106,800**
- `SoVLines[3b].current_amount`: $312,800 → **$337,000**
- `SoVLines[3c].current_amount`: $87,200 → **$89,300**

---

## In-flight Sub Pay Application

A monthly pay app from Brothers & Bricks (sub_to_gc) for period ending March 2026:

```
direction: sub_to_gc
subcontract: 215-002
period_start: 2026-03-01
period_end: 2026-03-31
status: submitted   (PM has not yet reviewed)
submitted_at: 2026-03-31T16:42:00-05:00

PayApplicationLines (only this sub's SoV lines):
  3a: previously_billed=$0, sub_reported_percent=85.00, this_period=$83,640.00, retention=$8,364.00
  3b: previously_billed=$0, sub_reported_percent=40.00, this_period=$125,120.00, retention=$12,512.00
  3c: previously_billed=$0, sub_reported_percent=60.00, this_period=$52,320.00, retention=$5,232.00
  3d: previously_billed=$0, sub_reported_percent=15.00, this_period=$7,233.30, retention=$723.33
  3e: previously_billed=$0, sub_reported_percent=0.00, this_period=$0.00, retention=$0.00

total_billed: $268,313.30
total_retention: $26,831.33
```

**Why this seed shape is useful:**
- Demonstrates parent/child SoV breakdown (line 3 with 5 children)
- Demonstrates a CO mid-flight that needs to propagate
- Demonstrates a sub pay app awaiting PM review
- Realistic dollar amounts (matches transcript-scale $576k masonry sub)
- Realistic numbers for testing every invariant in `gc-data-model.md`
- Anonymized — no Spartan PII or proprietary numbers

---

## What's NOT in the seed (left to manual creation in dev/test)

- Owner-direction PayApplication (compose from approved sub pay apps once we have multiple subs in `approved` state)
- SwornStatement (depends on approved owner pay app)
- DocumentAttachments (R2 uploads — populate during dev as needed)
- ApprovalEvents beyond what's needed to reach the seeded states (they accumulate naturally as state transitions happen)
- Multiple projects (we start with just project 215; add more during integration testing)

---

## Implementation note for Day 5

When converting this spec to `seed/project-215.ts`:
- Use Drizzle's typed insert helpers
- Wrap entire seed in a transaction
- Make idempotent: `delete from <tables> where tenant_id = <acme tenant>` first, then insert
- Provide a CLI: `pnpm db:seed` runs the seed against the configured DATABASE_URL
- Snapshot expected invariant outputs (run drift checks after seed; assert all clean)
