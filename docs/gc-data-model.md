# construct-app — Data Model

Authoritative reference for all entities, relationships, fields, and invariants. Use this as the source for the Whimsical ERD.

**Multi-tenancy:** every entity carries `tenant_id` (the GC firm). Enforced at query layer + Postgres row-level security.

**Naming convention:** snake_case for column names, PascalCase for entity names in this doc.

---

## Entities

### Tenant
The GC firm. Top of the hierarchy.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | Firm name |
| slug | text | URL-safe identifier |
| created_at | timestamptz | |

### User
Internal user (Principal, Finance, PM, Assistant) OR external invitee (Subcontractor user, Architect, Owner).

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant. NULL for external (architect/owner) using magic-link. |
| email | text | Unique per tenant |
| display_name | text | |
| role | enum | principal / finance / pm / assistant / sub_user / architect / owner |
| clerk_user_id | text | FK to Clerk identity |
| created_at | timestamptz | |

### Organization
External orgs (project owners, architecture firms). Reusable across projects.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| name | text | |
| type | enum | owner / architect |
| address, contact_email, contact_phone | text | |
| created_at | timestamptz | |

### Subcontractor
Reusable directory entry per tenant. Distinct from Organization for clean separation of concerns.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| name | text | Company name |
| contact_email, contact_phone, address | text | |
| created_at | timestamptz | |

### Project
A construction project owned by the GC.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| project_number | text | Tenant-scoped number (e.g., "215") |
| name | text | |
| owner_id | uuid | FK Organization (type=owner) |
| architect_id | uuid | FK Organization (type=architect) |
| original_contract_amount | numeric(14,2) | |
| status | enum | draft / active / on_hold / closed |
| start_date, target_completion_date | date | |
| created_at | timestamptz | |

### Subcontract
The agreement between a Project and a Subcontractor. Carries the contract amount and the running ceiling.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| project_id | uuid | FK Project |
| subcontractor_id | uuid | FK Subcontractor |
| contract_number | text | |
| original_amount | numeric(14,2) | |
| current_amount | numeric(14,2) | **Derived** = original + sum of approved CO line amounts. Cached for query performance; can be recomputed. |
| spec_sections | text[] | |
| inclusions, exclusions | text | |
| status | enum | draft / active / closed |
| signed_contract_attachment_id | uuid | FK DocumentAttachment, nullable |
| created_at | timestamptz | |

### SoVLine
A line item in the project's Schedule of Values. Hierarchical via `parent_line_id` for breakdowns.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| project_id | uuid | FK Project |
| parent_line_id | uuid | FK SoVLine, nullable (NULL = top-level) |
| line_number | text | "3" for parent; "3a", "3b" for children |
| description | text | |
| subcontract_id | uuid | FK Subcontract, nullable (NULL = GC-internal cost: bonding, permits, etc.) |
| contract_amount | numeric(14,2) | Original allocation |
| current_amount | numeric(14,2) | After CO adjustments |
| stored_materials_amount | numeric(14,2) | Running total of stored materials billed |
| created_at | timestamptz | |

### ChangeOrder
A change to project scope. Has many ChangeOrderLine entries that target specific SoVLines and/or Subcontracts.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| project_id | uuid | FK Project |
| co_number | text | |
| description, justification | text | |
| affected_subcontract_id | uuid | FK Subcontract, nullable |
| total_amount | numeric(14,2) | Sum of all line `delta_amount` values |
| status | enum | draft / pending_principal / pending_architect / architect_rejected / pending_owner / owner_rejected / approved / cancelled |
| approved_at | timestamptz | nullable |
| created_by_user_id | uuid | FK User |
| created_at | timestamptz | |

### ChangeOrderLine
A single add or deduct against a SoVLine.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| change_order_id | uuid | FK ChangeOrder |
| sov_line_id | uuid | FK SoVLine |
| delta_amount | numeric(14,2) | Positive = add, negative = deduct |
| reason | text | |

### PayApplication
A monthly pay request. Direction matters: sub→GC or GC→owner.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| project_id | uuid | FK Project |
| direction | enum | sub_to_gc / gc_to_owner |
| period_start, period_end | date | |
| subcontract_id | uuid | FK Subcontract, nullable (set if direction=sub_to_gc) |
| status | enum | (see PayApp state machine in gc-state-machines.md) |
| total_billed | numeric(14,2) | Sum of all PayApplicationLine.this_period_amount |
| total_retention | numeric(14,2) | Sum of all PayApplicationLine.retention_amount |
| submitted_at, approved_at | timestamptz | nullable |
| created_at | timestamptz | |

### PayApplicationLine
One line in a pay application, scoped to a specific SoVLine.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| pay_application_id | uuid | FK PayApplication |
| sov_line_id | uuid | FK SoVLine |
| previously_billed_amount | numeric(14,2) | Snapshot at time of pay app |
| sub_reported_percent | numeric(5,2) | What sub said |
| gc_adjusted_percent | numeric(5,2) | What GC approved (defaults to sub_reported_percent) |
| this_period_amount | numeric(14,2) | Computed from gc_adjusted_percent × current_amount minus previously_billed |
| stored_materials_amount | numeric(14,2) | |
| retention_amount | numeric(14,2) | Typically 10% of this_period_amount |
| gc_note | text | Optional explanation when GC adjusts |

### SwornStatement
Generated alongside an owner-direction pay app.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| pay_application_id | uuid | FK PayApplication (direction=gc_to_owner) |
| generated_pdf_attachment_id | uuid | FK DocumentAttachment |
| signed_pdf_attachment_id | uuid | FK DocumentAttachment, nullable |
| notarized_pdf_attachment_id | uuid | FK DocumentAttachment, nullable |
| status | enum | (see SwornStatement state machine) |
| created_at | timestamptz | |

### DocumentAttachment
Polymorphic attachments — any entity can have files attached.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| entity_type | text | 'project' / 'subcontract' / 'pay_application' / 'change_order' / 'sov_line' / 'sworn_statement' / 'subcontractor' |
| entity_id | uuid | FK to whichever entity |
| filename | text | |
| storage_key | text | R2 object key |
| mime_type | text | |
| size_bytes | bigint | |
| uploaded_by_user_id | uuid | FK User |
| created_at | timestamptz | |

### ApprovalEvent
Immutable event log for state transitions. The audit trail.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| entity_type | text | 'change_order' / 'pay_application' / 'sworn_statement' |
| entity_id | uuid | |
| from_status | text | |
| to_status | text | |
| actor_type | enum | internal_user / external_invitee / system |
| actor_user_id | uuid | FK User, nullable |
| actor_external_email | text | Set when actor_type=external_invitee |
| comment | text | |
| created_at | timestamptz | |

### Invitation / MagicLink
External-party access tokens scoped to a single action.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK Tenant |
| target_entity_type | text | 'pay_application' / 'change_order' / 'sworn_statement' |
| target_entity_id | uuid | |
| recipient_email | text | |
| recipient_role | enum | architect / owner / sub_user |
| token_hash | text | Hashed token; raw token never stored |
| action | enum | review_only / approve_or_reject |
| expires_at | timestamptz | Default: created_at + 72h |
| consumed_at | timestamptz | nullable; set on first action |
| created_at | timestamptz | |

---

## Relationships

- Tenant 1—N User, Organization, Subcontractor, Project
- Project 1—N SoVLine, Subcontract, ChangeOrder, PayApplication, DocumentAttachment
- Project N—1 Organization (owner), Organization (architect)
- Subcontract N—1 Subcontractor, Project
- SoVLine N—1 SoVLine (parent), Subcontract (optional)
- ChangeOrder 1—N ChangeOrderLine
- ChangeOrderLine N—1 SoVLine
- PayApplication 1—N PayApplicationLine
- PayApplication N—1 Subcontract (when direction=sub_to_gc)
- PayApplicationLine N—1 SoVLine
- SwornStatement 1—1 PayApplication (gc_to_owner direction)
- DocumentAttachment polymorphic to any entity
- ApprovalEvent polymorphic to (ChangeOrder | PayApplication | SwornStatement)

---

## Invariants (the part that kills drift)

These are enforced in the domain layer (`packages/domain`) as pure functions, called on every relevant write. Violations either block the write or surface on the Drift Dashboard.

1. **Sub billable ceiling:** for any approved PayApplication where `direction=sub_to_gc`, the sum of `(previously_billed + this_period)` across all lines, by subcontract, MUST be ≤ that subcontract's `current_amount`. If a sub tries to submit a pay app violating this → block submission with the standard "exceeds your ceiling" error.

2. **SoV integrity:** for each project, `sum(SoVLine.current_amount where parent_line_id IS NULL)` MUST equal `project.original_contract_amount + sum(approved CO total_amount)`. If this drifts, surface on the dashboard.

3. **Pay app rollup:** for any period, the sum of approved sub_to_gc pay app line amounts for a project + GC-internal SoV lines billed that period, SHOULD equal the gc_to_owner pay app for the same period (within reconciliation tolerance, e.g., $0.01). If it doesn't, surface on the dashboard.

4. **CO propagation atomicity:** when a ChangeOrder transitions to `approved`, the system in a single transaction:
   - Updates Subcontract.current_amount += total_amount (for the affected subcontract)
   - Updates each affected SoVLine.current_amount += corresponding ChangeOrderLine.delta_amount
   - Logs an ApprovalEvent
   - If any step fails, all rollback. **No partial propagation, ever.**

5. **Retention release:** retention sums are tracked separately from billed amounts. Release of retention is its own workflow (project closeout) — retention pay apps create separate PayApplicationLine entries with `previously_billed_amount = full_contract_amount` and `gc_adjusted_percent = 100`.

6. **Tenant isolation:** every query filters by `tenant_id`. Any join across entities asserts both sides have the same tenant_id. Postgres RLS as belt-and-suspenders.

7. **Magic-link single-use:** a MagicLink with `consumed_at IS NOT NULL` cannot be used again. Attempting to use a consumed or expired link → 410 Gone.

---

## Notes for Whimsical ERD

- Group entities visually:
  - **Tenant + Users** (auth/identity cluster, top-left)
  - **Project + Organizations + Subcontractors + Subcontracts** (project setup cluster, center-left)
  - **SoV + Change Orders** (financial scope cluster, center)
  - **Pay Applications + Lines + Sworn Statements** (billing cluster, center-right)
  - **Documents + Approval Events + Invitations** (cross-cutting cluster, bottom)
- Foreign keys: solid arrows
- Polymorphic relationships (DocumentAttachment, ApprovalEvent): dashed arrows with note "polymorphic"
- Inheritance / extension: not used (we don't subclass)
- Highlight invariant-critical fields in red: `Subcontract.current_amount`, `SoVLine.current_amount`, `PayApplication.status`, `ChangeOrder.status`
