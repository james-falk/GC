# construct-app — Wireframe Brief

Detailed screen-by-screen specs designed to be fed into Paper (or any wireframing tool). Each screen documents purpose, role, layout, key elements, states, and primary actions.

**Visual style cue (apply globally):** Linear/Notion density. Neutral grays for chrome, restrained color (one primary accent for key actions, red only for errors/destructive). Mobile-friendly for screens 6 and 11. All others are desktop-first.

**Primary nav structure (Screen 1 = persistent shell):** Dashboard, Projects, Subcontractors, Pay Apps, Change Orders, Documents, Drift Alerts, Settings.

---

## Screen 1 — App Shell

**Purpose:** Persistent chrome and navigation surrounding all internal-user views.
**Role:** All authenticated internal users (Principal, Finance, PM, Assistant).

**Layout:**
- Top bar (full-width, ~56px tall):
  - Left: construct-app logo
  - Left-of-center: Project switcher dropdown (currently active project name with caret)
  - Right: Notifications bell (with badge for unread), User avatar menu
- Left sidebar (collapsible, default ~240px):
  - Nav items: Dashboard, Projects, Subcontractors, Pay Apps, Change Orders, Documents, Drift Alerts, Settings
  - Active item: subtle primary-color background tint + slightly bolder weight
  - Collapse toggle at bottom
- Main content area: page content with breadcrumbs at top

**States:**
- Loading: skeleton lines in main area, sidebar/topbar already rendered
- No project selected: project switcher reads "Select a project"

---

## Screen 2 — GC Dashboard

**Purpose:** At-a-glance project health + drift alerts.
**Role:** PM, Principal, Finance.

**Layout:**
- Stat cards row (4 cards, equal width):
  - Active projects (count, link)
  - Pay apps in flight (count + secondary badge "X awaiting review")
  - COs pending approval (count)
  - Drift alerts (count, **red badge** if > 0)
- Two-panel row:
  - Left (60% width): "Drift Alerts" panel
    - Scrollable list of alert cards
    - Each card: severity icon (red/yellow/info), type label ("Sub above ceiling" / "CO not propagated" / "Pay app rollup mismatch"), project name, brief description, "View" button
  - Right (40% width): "Recent Activity" panel
    - Chronological feed: who did what, when (timestamps relative — "3 hrs ago")
- Recent projects grid (cards, 3 across):
  - Project name (bold), Owner name, % complete (progress bar), Current pay app status badge

**Empty states:**
- Drift Alerts: muted "All clear — no drift detected"
- Recent Activity: "No activity in the last 7 days"
- Recent Projects: prominent CTA "Create your first project"

**Primary actions:**
- Click drift alert → Screen 12 (Drift detail)
- Click project card → Screen 3 (Project detail)
- "+ New Project" button (top right of grid)

---

## Screen 3 — Project Detail (Tabbed)

**Purpose:** Hub for all artifacts of a single project.
**Role:** All internal.

**Layout:**
- Header (full width, ~120px):
  - Top row: Project name (large, bold), status badge (Active/On Hold/Closed), kebab menu (Edit, Archive)
  - Bottom row: Owner name, Architect name, Original contract amount $, Current value $ (after COs), Start date, Target completion
- Tab nav (under header): SoV, Subs, Pay Apps, Change Orders, Documents
- Tab content: switches based on active tab (see Screens 4–9)

**Notes:**
- Header values are read-only from this view (edit via kebab menu modal)
- Active tab visually distinguished (underline + bolder text)

---

## Screen 4 — Schedule of Values Editor

**Purpose:** Define and edit the project's SoV.
**Role:** PM, Principal.

**Layout:**
- Action bar (top): "Add line", "Add breakdown" (active only when a parent line is selected), "Import from contract", search input, view-toggle (List / Grouped by Sub)
- Data table (full width, sticky header):
  - Columns: Line # (e.g., "3" or "3a"), Description, Subcontractor (linked, optional chip), Original $, COs $, Current $, Stored Materials $, Previously Billed $, This Period %, This Period $, Retention $, Balance to Finish, Drift indicator
  - Rows: parent lines + collapsible children for breakdowns (e.g., "3 — Masonry" expands to "3a, 3b, 3c")
  - Visual: parent rows bold, child rows indented + lighter
  - Inline edit for description and percentages (click cell → input)
- Footer row (sticky, always visible): sums of Original, Current, This Period, Retention
- Drift indicator: red dot in last column for lines that don't reconcile (tooltip explains)

**Empty state:** "No line items yet — start by importing from your contract or adding manually"

**Visual style:** spreadsheet density (Notion table). Money columns right-aligned with $ + thousands separators. Subcontractor chips: avatar + name, click opens Screen 5 detail.

---

## Screen 5 — Subcontract List + Detail

**Purpose:** Manage all subcontractors on the project.
**Role:** PM, Principal, Finance.

**List view (Subs tab):**
- Action bar: "+ Add Subcontract", search, status filter (Draft / Active / Closed)
- Table: Sub name (avatar+chip), Contract #, Original $, COs $, Current $, Billed-to-Date $, Balance, Status badge
- Click row → Detail view

**Detail view:**
- Header: Sub name, contract number, status badge
- Tabs: Contract Info, SoV Lines, COs, Pay Apps, Documents
  - Contract Info: editable fields (spec sections, inclusions, exclusions, dates), attached signed contract PDF (preview thumbnail + download)
  - SoV Lines: filtered SoV table for lines linked to this subcontract
  - COs: all change orders affecting this subcontract
  - Pay Apps: history of this sub's pay applications with status badges
  - Documents: contracts, COIs, W-9s, certified payroll, etc.

---

## Screen 6 — Sub Pay App Submission Portal ("Contractor Invoice Form")

**Purpose:** Subcontractor's monthly pay-app form. **The most important screen for sub adoption.**
**Role:** Subcontractor (external, magic-link or invited account). **Mobile-first.**

**Layout (single column, mobile-friendly):**
- Compact header: construct-app logo, project name (read-only), period (read-only), sub's contract amount (read-only)
- Form body — repeating block per SoV line (only this sub's lines):
  - Line description (read-only text)
  - Current contract $ (read-only)
  - Previously billed $ (read-only)
  - **This period %** (input — slider OR number with steppers, both visible)
  - This period $ (computed, read-only, large/prominent)
  - **Stored materials $** (input)
  - Retention $ (computed, read-only)
- Attachments section: drag-drop zone, "Upload supporting documents". Uploaded files shown as chips with remove button.
- Sticky footer:
  - Total this period $ (computed)
  - Total retention $ (computed)
  - Net to invoice $ (computed, large/prominent)
  - Buttons: "Save draft" (secondary), "Submit for review" (primary)

**Validation (real-time):**
- If any line's `previously_billed + this_period > current_contract`: line outlined red, inline error: "This exceeds your contract ceiling. Submit a change order with the GC if additional work is approved."
- Submit button disabled until validation passes

**States (banners at top):**
- Draft: editable, no banner
- Submitted: read-only, blue banner "Awaiting GC review — submitted [date]"
- Needs Revision: editable, yellow banner with GC's comments
- Approved: read-only, green banner "Approved [date] by [GC user]"

---

## Screen 7 — GC Pay App Review

**Purpose:** GC PM reviews a sub's submitted pay app, with the power to override percentages.
**Role:** PM, Principal.

**Layout (two-column desktop, stacked mobile):**
- Top bar: Sub name, period, submission timestamp, submitter name
- LEFT (60%): Line-by-line review table
  - Columns: Description, Current $, Previously Billed, **Sub reported %**, **GC adjusted %** (editable), This period $ (computed from adjusted), Note (optional editable)
  - Default: GC adjusted % = sub-reported %. PM only changes if disagreeing.
  - Visual diff when PM lowers a value: struck-through original + new value
- RIGHT (40%): Sub's uploaded supporting PDFs (preview, scrollable, tabs if multiple)
- Bottom action bar (sticky):
  - "Request revision" (sends back with required comment field)
  - "Approve sub pay app" (locks adjustments, advances state)
  - If queue: "Approve and continue to next sub"

---

## Screen 8 — Change Order Create + Approval Trail

**Purpose:** Draft a CO, route through approval flow, watch it auto-propagate on approval.
**Role:** PM (drafts), Principal (internal review), Architect (external), Owner (external).

**Create form (left side, 60% width):**
- Form fields:
  - CO number (auto, editable)
  - Description (text area)
  - Affected Subcontract (dropdown)
  - Affected SoV lines (multi-select with type-ahead)
  - **Line items table**: rows of (Line description, Add/Deduct $, Reason). Add/Deduct allows positive or negative.
  - Total impact $ (computed, displayed prominently)
  - Justification (text area)
  - Attachments (drag-drop)
- Buttons: Save Draft, Submit for Approval

**Approval Trail panel (right side, 40% width, always visible):**
- Vertical timeline:
  - Created — timestamp, by user
  - Sent to Architect — timestamp + magic-link
  - Architect Approved/Rejected — timestamp + comments
  - Sent to Owner — timestamp + magic-link
  - Owner Approved/Rejected — timestamp + comments
  - **Auto-propagated** — timestamp, with diff: "Subcontract current $ updated from $X to $Y; SoV line 3a current $ updated from $A to $B"
- Visual: status icons (clock for pending, check for done, X for rejected)

**On owner approval → auto-propagate:** green banner across the top: "✓ Auto-propagated to subcontract and SoV. Sub's new ceiling: $X. SoV line 3 new current: $Y."

---

## Screen 9 — AIA Pay App Preview

**Purpose:** Preview the GC→Owner pay app PDF before submission. Track signature/notarization status.
**Role:** PM, Principal.

**Layout:**
- LEFT (70%): PDF viewer (embedded), full-height, scrollable
- RIGHT (30%): Metadata sidebar
  - Period
  - Status badge: Generated / Sent / Signed / Notarized / Architect-Approved / Owner-Approved / Paid
  - Signature placeholder status (with visual indicators)
  - Notarization status
  - **Action buttons (status-dependent — only relevant ones shown):**
    - Generate fresh (always)
    - Download PDF (always)
    - Upload signed copy (when status = Generated)
    - Mark notarized (when status = Signed)
    - Send to architect (when status = Notarized)
    - Send to owner (when status = Architect-Approved)
    - Mark owner-paid (when status = Owner-Approved)

---

## Screen 10 — Sworn Statement Preview

Same UI pattern as Screen 9, different document content. Status states: Generated → Signed → Notarized → SentToArchitect → ArchitectApproved → SentToOwner → OwnerApproved → ProjectClosed.

---

## Screen 11 — External Magic-Link Approval View

**Purpose:** Architect or Owner reviews and approves a pay app, sworn statement, or change order. **No account required.**
**Role:** Architect, Owner (external, magic-link). **Mobile-first.**

**Layout — Stripe-receipt-style minimalism:**
- Header: construct-app logo, project name, document type (e.g., "Pay Application #5 — Period ending Apr 30, 2026")
- Document preview: embedded PDF viewer (full-width on mobile, ~70% on desktop)
- Approval section (below or beside PDF on desktop):
  - Comments box (optional, multi-line)
  - Two large buttons: **"Approve"** (primary green) / **"Request Changes"** (secondary)
- After action: success page — "Thank you. construct-app will be notified."

**Notes:**
- No login prompt, no account creation
- Magic-link expires after action OR after configurable TTL (default 72 hrs)
- Mobile-first: architects often review from job sites on phones

---

## Screen 12 — Drift Detail View

**Purpose:** Detailed view of a single drift violation with one-click resolution paths.
**Role:** PM, Finance.

**Layout:**
- Header: severity icon, violation title (e.g., "Sub billed above ceiling"), project name, breadcrumb back to dashboard
- Body:
  - **What's wrong** (plain English): "Brothers & Bricks billed $200,000 on line item 3a, but their current contract ceiling is $150,000."
  - **Where the data is**: links to offending entities (sub pay app, SoV line, etc.) — open in new tab
  - **How to fix** (action buttons):
    - "Submit a change order to increase the ceiling" → opens Screen 8 pre-filled
    - "Reject this sub pay app submission" → opens Screen 7
    - "Mark as acknowledged" (silences alert without fixing — for true edge cases)
- Right panel (~30%): timeline — when this drift was first detected, history of similar drifts on this project

---

## Notes for Paper (when generating wireframes)

- Stick to grayscale + one primary accent (suggest navy or deep blue) until visual polish phase
- Use real numbers from `gc-seed-data.md` for any examples — makes wireframes feel real, not mocky
- For the Sub Pay App portal (Screen 6) and External Magic-Link view (Screen 11), prioritize mobile mockups first (architects + subs are on phones)
- Drift Alerts use red dots / icons but keep red sparing — don't make the dashboard feel like a bug tracker
- Money values: always 2 decimals, $ prefix, thousands separators (e.g., $576,622.00)
