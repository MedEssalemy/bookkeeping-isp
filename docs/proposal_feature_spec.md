# Proposal Feature — Spec

**Module:** Proposals (Standard + MP)
**Surfaces:** Entry form · List view · View page
**Stack reference:** see `Bookkeeping_Implementation_Plan.md`. Reuse existing base components (`BaseInput`, `BaseSelect`, `BaseDatePicker`, `RichTextEditor`, `DataTable`, `StatusBadge`, `ConfirmModal`, `ActionButtons`, `EmptyState`).
**Status:** Ready to implement.

---

## 0. Scope

Build the three proposal-feature surfaces:

1. **List view** at `/proposals` — table, filters, row actions.
2. **Entry form** at `/proposals/new` and `/proposals/:id/edit` — create / update.
3. **View page** at `/proposals/:id` — read-only detail with actions.

One unified form covers both proposal types (`Standard`, `MP`) using a Type selector that conditionally swaps a small set of fields and tweaks the line-items table. Type cannot be changed after first save.

**Out of scope for this spec:** Purchase Order cascade UI (the *prompt* on status → Accepted is in scope; the PO form itself is a separate feature). Notes-rich-text-to-docxtpl conversion (handled by the backend doc-generation layer).

---

## 1. Routes & layout decisions

| Route | Page | Layout |
|---|---|---|
| `/proposals` | List view | Standard list page (header + filters + data table + empty state) |
| `/proposals/new` | Entry form (create) | **Full page** (not slide-over) |
| `/proposals/:id/edit` | Entry form (edit) | Full page |
| `/proposals/:id` | View page (read-only) | Full page mirroring the form layout, fields disabled |

**Why full page (not the existing SlideOver):** the form has 15+ header fields, two rich-text editors, and an editable line-items table. A 480 px slide-over is too cramped. Existing SlideOver pattern remains the convention for simpler forms (Client, Tax Rate). If you'd rather keep slide-over for consistency, widen it to 720 px and accept that line items will scroll horizontally on smaller screens.

---

## 2. Data dependencies

This feature reads from three sibling tables. Their schemas are owned by other modules but their shape is assumed here.

### 2.1 `clients` (one row per client *contact record*)

```
id, name, address, title, business_name, department, phone, email, city, state
```

Same `name` may appear with multiple `address` rows. The `(name, address)` pair is the natural lookup key for contact metadata.

### 2.2 `mp_destinations` (separate from clients)

```
id, final_destination, physical_address
```

Used only by MP proposals. `final_destination` is the dropdown label; `physical_address` auto-fills the proposal's Address field.

> If this table doesn't exist yet, create it as part of this work — it's needed by MP. Treat as Admin-managed in Settings → Lists (parallel to Tax Rates). One row per destination. CRUD is out of scope for this spec; for v1 it's acceptable to seed the table from a CSV the client provides.

### 2.3 `tax_rates`

```
id, location (city), state, rate, source
```

Lookup is `WHERE location ILIKE :city AND state = :state`. Returns 0 when no match.

---

## 3. API endpoints

All under `/api/v1`. Roles: Admin & Editor can mutate; Viewer is read-only.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/proposals` | List with filters: `status`, `type`, `client`, `from`, `to`, `q`, `page`, `page_size` |
| `GET` | `/proposals/:id` | Full proposal incl. line items |
| `POST` | `/proposals` | Create (server generates `number` if not provided) |
| `PATCH` | `/proposals/:id` | Update header + line items (full replace of `line_items` array) |
| `DELETE` | `/proposals/:id` | Delete (blocked if linked POs exist) |
| `PATCH` | `/proposals/:id/status` | Status transition; returns updated proposal |
| `POST` | `/proposals/:id/generate-document` | Returns `.docx` blob (Content-Disposition attachment) |
| `GET` | `/proposals/:id/preview` | Returns rendered HTML for in-app preview (mammoth-style fidelity) — *or* return PDF if a converter is wired up |
| `GET` | `/proposals/next-number?type=standard\|mp` | Returns the next auto-number (`Q-260042` / `PQ-260008`) without committing |
| `GET` | `/clients/lookup?name=:name` | Returns array of `{address, title, business_name, department, phone, email, city, state}` rows for that name (could be 0..N) |
| `GET` | `/mp-destinations` | List (for the Project Location dropdown) |
| `GET` | `/tax-rates/lookup?city=:city&state=:state` | Returns `{rate}` or `{rate: 0}` if no match |

**Numbering scheme** (server-side, per implementation plan §7):
- Standard: `Q-YY####` (e.g. `Q-260042`)
- MP: `PQ-YY####`
- Year resets the counter. Compute as `MAX(existing) + 1` inside the create transaction.
- `GET /next-number` is a *preview* — does not reserve. Final number assigned on `POST /proposals`.

---

## 4. Entry form

### 4.1 Layout

Full-page form. Two-column grid for header fields. Sticky page header with title + Save / Cancel. Sticky footer not needed because totals are inline.

```
┌─────────────────────────────────────────────────────────────┐
│ Header: "New Proposal" / "Edit Q-260042"   [Cancel] [Save] │
├─────────────────────────────────────────────────────────────┤
│ Section: Header                                             │
│   2-column grid of fields                                   │
├─────────────────────────────────────────────────────────────┤
│ Section: Line Items                                         │
│   Editable table + "+ Add Row"                              │
├─────────────────────────────────────────────────────────────┤
│ Section: Tax & Totals                                       │
│   Taxable toggle, Tax Rate, Subtotal/SalesTax/Total cards   │
├─────────────────────────────────────────────────────────────┤
│ Section: Notes (Tier 1 RTE)                                 │
│ Section: Services Provided (MP only, Tier 1 RTE)            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Header section — fields

`*` = required. Greyed cells = field hidden in that variant.

| # | Field | Type | Standard | MP | Notes |
|---|---|---|---|---|---|
| 1 | Date * | date | ✓ | ✓ | Default: today. Editable. |
| 2 | Proposal # * | text | ✓ | ✓ | Auto-generated server-side, prefilled via `GET /next-number`, editable. Uniqueness validated on save. |
| 3 | Type * | select (`Standard` / `MP`) | ✓ | ✓ | Locked after first save (read-only with tooltip). |
| 4 | Status | select | ✓ | ✓ | Default: `Draft`. Options: Draft / Sent / Accepted / Declined. |
| 5 | Client Name * | combobox | ✓ | — | Searchable. Source: distinct names from `clients`. See §4.7.1. |
| 6 | Address * | combobox | ✓ | — | See §4.7.1 — auto / manual depending on lookup result. |
| 7 | Title | text | ✓ | — | Auto-filled from `(client_name, address)`. Editable override. |
| 8 | Business Name | text | ✓ | — | Auto-filled. Editable. |
| 9 | Department | text | ✓ | — | Auto-filled. Editable. |
| 10 | Phone | text | ✓ | — | Auto-filled. Editable. |
| 11 | Email | email | ✓ | — | Auto-filled. Validated on blur. Editable. |
| 12 | Project No. | text | ✓ | ✓ | Free text. |
| 13 | Project Name | text | ✓ | ✓ | Free text. (MP: future link to a Projects table — out of scope.) |
| 14 | Agreement No. | text | ✓ | — | Free text. |
| 15 | Proposal Valid Till | date | ✓ | — | Optional. Calendar + manual input. |
| 16 | Reference | text | — | ✓ | Free text. |
| 17 | Project Location | select | — | ✓ | Source: `mp_destinations.final_destination`. Selecting fills #18. |
| 18 | Address | text | — | ✓ | Auto-filled from selected Project Location. Editable override. |
| 19 | Project Type | text | — | ✓ | Free text. |

### 4.3 Tax & Totals section — fields

| Field | Type | Standard | MP | Notes |
|---|---|---|---|---|
| Taxable | toggle (Yes/No) | ✓ | ✓ | Default: **Yes for Standard**, **No for MP**. |
| Tax Rate | number (%) | ✓ | ✓ | Auto-filled from city. Editable when Taxable=Yes. Disabled & shown as 0 when Taxable=No. See §4.7.3. |
| Subtotal | computed | ✓ | — *(see note)* | `SUM(line_items.amount)`. Read-only card. |
| Sales Tax | computed | ✓ | — *(see note)* | `tax_rate × subtotal`. Read-only card. |
| Total | computed | ✓ | ✓ | Standard: `subtotal + sales_tax`. MP: `SUM(estimated_fee) × (1 + tax_rate)`. Read-only card. |

> **MP totals display:** the legacy VBA shows only `Total` on MP forms and in MP docs. Mirror that. Internally still compute `subtotal` and `sales_tax` (you'll want them for reports and for Subtotal-derived analytics later) but don't render them in the MP variant.

### 4.4 Line Items section

#### Standard variant — columns

| Column | Editor | Notes |
|---|---|---|
| Job Code | select | Options sourced from the configurable Job Code Tag Library (Settings → Lists). |
| Description | text | Free. |
| Est. Qty / Hours | number | Optional (nullable). Right-aligned. |
| Rate | number | Right-aligned. Currency-formatted on blur. |
| **Amount** | **computed** | See formula below. Right-aligned, read-only. |
| ✕ | button | Removes row. |

**Amount formula (Standard):**
```
amount = qty IS NULL ? rate : qty * rate
```
Treat *null/empty* qty as the lump-sum case. A qty of `0` means zero (`0 * rate = 0`) — that's not the lump-sum branch. This mirrors the legacy `IF([Est. Qty/Hours]="", [Rate], [Est. Qty/Hours]*[Rate])`.

#### MP variant — columns

| Column | Editor | Notes |
|---|---|---|
| Job Code | hidden / fixed | Stored as `"Medical Physics Services"` on save; not displayed in the table editor. |
| Services | text | Free. (Maps to legacy `Services` column.) |
| Hourly Rate | number | Optional (nullable). Right-aligned. Currency-formatted on blur. |
| Hours Estimated | number | Right-aligned. |
| **Estimated Fee** | **computed** | See formula. Read-only. |
| ✕ | button | Removes row. |

**Estimated Fee formula (MP):**
```
estimated_fee = hourly_rate IS NULL ? hours_estimated : hourly_rate * hours_estimated
```
Same nullable trick as Standard: when no rate, the `Hours Estimated` field is treated as the lump-sum fee.

#### Shared behavior

- "+ Add Row" appends a blank row at the bottom.
- Reordering rows is **not** supported in v1. The order at save time becomes `item_order` 1..N.
- Empty rows (where the required field — Description / Services — is blank) are dropped at save time, not before. They don't count toward validation.
- Keyboard: Tab cycles through editable cells; Enter on the last cell adds a new row.

### 4.5 Notes & Services Provided

Both fields use **`RichTextEditor`** (the existing TipTap wrapper, Tier 1 toolbar only — bold, italic, underline, line breaks, unordered bullets).

| Field | Standard | MP | Stored as | Doc placeholder |
|---|---|---|---|---|
| Notes | ✓ | ✓ | HTML fragment | `{{ note }}` (with conditional title block) |
| Services Provided | — | ✓ | HTML fragment | `{{ services_provided }}` |

**No auto-population.** Both fields are user-edited free input.

> The legacy `<<ServicesProvided>>` placeholder in the MP doc was previously generated from the items table at doc-generation time. We are deliberately replacing that with a user-controlled rich text field. Backend doc generation must read from this field, not regenerate from items.

### 4.6 Computed-field reactivity

All computed fields update **synchronously** on input change (no debounce — all data is local until save).

```
line_items[].amount       ← derived from row's qty/rate
line_items[].estimated_fee ← derived from row's rate/hours
subtotal                  ← Σ amounts (Standard) / Σ fees (MP, hidden)
sales_tax                 ← tax_rate × subtotal
total                     ← subtotal + sales_tax
```

Format on display: `$#,##0.00`. Format on input: raw number, currency formatting applied on blur.

### 4.7 Lookup behaviors

#### 4.7.1 Client Name → Address → contact fields (Standard)

```
on Client Name change:
  rows ← GET /clients/lookup?name=:name
  if rows.length === 0:
    Address dropdown empty; show validation hint
  if rows.length === 1:
    autofill Address + Title + Business + Dept + Phone + Email
    autofill city/state for tax-rate lookup
    set tax_rate via §4.7.3
  if rows.length > 1:
    Address dropdown becomes enabled with the N matching addresses
    other contact fields cleared, awaiting Address selection

on Address change (manual selection from the N):
  match the (name, address) row, autofill remaining contact fields
  set tax_rate via §4.7.3
```

All autofilled fields remain user-editable. A manual edit does **not** reset on subsequent lookups within the same form session — it persists. (The user might be writing a one-off address override.)

#### 4.7.2 Project Location → Address (MP)

```
on Project Location change:
  destination ← row from mp_destinations
  Address ← destination.physical_address
  set tax_rate via §4.7.3 using destination's city/state
```

Address is editable after autofill. Editing Address manually does **not** trigger a tax recompute — only Project Location changes do.

#### 4.7.3 Tax rate resolution

```
on Taxable toggle Yes → No:
  tax_rate ← 0
  field disabled

on Taxable toggle No → Yes:
  tax_rate ← GET /tax-rates/lookup?city=:city&state=:state (0 if no match)
  field enabled

on city change (Standard: from Address autofill; MP: from Project Location):
  if Taxable === Yes AND tax_rate has not been manually edited in this session:
    tax_rate ← lookup result
  if Taxable === Yes AND tax_rate WAS manually edited:
    keep manual value (sticky override)

on user types in tax_rate field:
  set internal flag `tax_rate_edited = true`
  flag clears when Taxable is toggled (either direction)
```

A subtle but important rule: the manual-override flag resets on Taxable toggle, so a user can recover the auto-lookup behavior by flipping Taxable off then on.

### 4.8 Validation

#### Required fields

| Variant | Required |
|---|---|
| Standard | Date, Proposal #, Client Name, Address, ≥1 line item with non-empty Description |
| MP | Date, Proposal #, ≥1 line item with non-empty Services |

(MP does not require Project Location, Reference, or Address — matches the VBA's `mandatoryFields` array. They're optional in v1.)

#### Format validation

| Field | Rule |
|---|---|
| Email | RFC-style validation on blur. Empty allowed (it's optional). |
| Tax Rate | Number ≥ 0. Allow up to 4 decimals. |
| Rate, Hourly Rate, Qty, Hours | Number ≥ 0. Allow up to 2 decimals on currency, 2 on quantities. Empty (null) allowed where the formula treats it as lump-sum. |
| Proposal # | Non-empty. Pattern check is *advisory* (`^(Q|PQ)-\d{2}\d{4}$`) — warn on mismatch but allow override. Server enforces uniqueness only. |
| Date / Valid Till | Valid date. Valid Till should be ≥ Date (warn if not, but allow). |

#### Inline error display

Use `BaseInput`'s built-in error slot (red text, 12px, below the field). On Save click, validate all fields, scroll to the first error.

### 4.9 Save behavior

```
on Save click:
  validate (§4.8) → if errors, abort with toast "Fix highlighted fields"
  drop empty line item rows
  if creating:
    POST /proposals { ...payload }
    on 409 (number conflict): show modal "Proposal Q-260042 already exists. Replace it?" [Replace] [Cancel]
      Replace → PATCH the existing proposal with current payload
    on 200: toast "Proposal Q-260042 saved.", navigate to /proposals/:id
  if editing:
    PATCH /proposals/:id { ...payload }
    on 200: toast "Proposal Q-260042 updated.", navigate to /proposals/:id

on Status change to "Accepted":
  ConfirmModal: "Create a linked PO from this proposal?" [Create PO] [Just save]
  Either choice still saves the status change.
  Create PO → navigate to /purchase-orders/new?from_proposal=:id (handled by PO feature, out of scope here).
```

**Document is *not* auto-generated on save.** The user explicitly clicks "Generate Document" from the list view or view page. (Legacy VBA generates on save; we're separating the concerns to make Save fast and document generation auditable.)

### 4.10 Cancel behavior

If the form is dirty (any field touched), Cancel triggers a `ConfirmModal`: *"Discard unsaved changes?"* [Discard] [Keep editing]. Otherwise navigate back without prompt.

---

## 5. List view (`/proposals`)

### 5.1 Page structure

```
Page header:
  Title "Proposals"
  Right side: [+ New Proposal] (Admin/Editor only)

Filter row (sticky):
  Status (Draft/Sent/Accepted/Declined, multi-select) ·
  Type (Standard/MP) ·
  Date range (from/to) ·
  Client (combobox) ·
  Search (free text — matches Proposal #, Project Name)

Data table (DataTable wrapper)

Empty state: EmptyState component with "+ New Proposal" CTA
```

### 5.2 Columns

| Column | Source | Notes |
|---|---|---|
| Proposal # | `number` | Bold. Click → `/proposals/:id`. |
| Date | `date` | Format: `MMM D, YYYY`. |
| Type | `type` | `StatusBadge` chip — `Standard` (gray) / `MP` (purple). |
| Client / Project | `client_name` (Standard) or `project_location` (MP) | Single column, dual-purpose label. |
| Project Name | `project_name` | Truncate at ~40 chars with tooltip. |
| Status | `status` | `StatusBadge` (Draft gray, Sent blue, Accepted green, Declined red). |
| Total | `total` | Right-aligned, currency. |
| Actions | — | `ActionButtons` slot. |

Default sort: Date descending. Clickable column headers for sort. Server-paginated (50 rows / page).

### 5.3 Row actions (`ActionButtons`)

| Action | Icon | Visible to | Behavior |
|---|---|---|---|
| Edit | pencil | Admin / Editor | → `/proposals/:id/edit` |
| Generate Document | download | Admin / Editor | Calls `POST /:id/generate-document`, browser saves blob as `{number}.docx` |
| Delete | trash (red) | Admin / Editor | `ConfirmModal`. Backend rejects if linked POs exist; show resulting error toast verbatim. |

### 5.4 Status quick-edit

Clicking the Status badge in a row opens a small popover with the four status options. Selecting one calls `PATCH /:id/status` and refetches. If transitioning to `Accepted`, the same prompt as §4.9 fires.

---

## 6. View page (`/proposals/:id`)

### 6.1 Layout

Mirrors the entry form layout. All inputs disabled (`readonly`, not visually destroyed — keep the form structure so the user recognizes it). Notes and Services Provided render the rich text as formatted HTML, not in the editor.

```
Page header:
  Title: "Q-260042"  [TypeBadge]  [StatusBadge]
  Right side: [Edit] [Generate Doc] [Preview Doc] [Delete]
              ↑ all role-gated per §13 of UI spec

Body: same sections as entry form, all disabled
```

### 6.2 Header actions

| Action | Visible to | Behavior |
|---|---|---|
| Edit | Admin / Editor | → `/proposals/:id/edit` |
| Generate Document | Admin / Editor | `POST /:id/generate-document` → download `{number}.docx` |
| Preview Document | Admin / Editor | Opens modal with rendered preview (see §7). |
| Status (chip is clickable) | Admin / Editor | Same popover as list view. |
| Delete | Admin / Editor | Same as list view. |

### 6.3 Status badge

Click to open status popover (same component as list view). Successful status change refetches the proposal in place.

---

## 7. Document preview & generation

### 7.1 Generation

Single endpoint: `POST /api/v1/proposals/:id/generate-document`. Backend:
1. Loads proposal + line items.
2. Picks template by type: `templates/proposal_standard.docx` or `templates/proposal_mp.docx`.
3. Renders via docxtpl with the placeholder map (see implementation plan §1).
4. Streams response with `Content-Disposition: attachment; filename="{number}.docx"`.

Frontend uses the binary-fetch → blob → `<a download>` pattern (per implementation plan §14).

### 7.2 Preview (in-app)

User clicks **Preview Document** on the view page → modal opens → backend returns a *rendering* of the same doc.

Two acceptable v1 implementations — choose one based on infra:

- **Option A — server-side PDF (preferred if LibreOffice headless is on the droplet):** `GET /:id/preview` returns a PDF; embed in an `<iframe>`. Highest fidelity to final doc.
- **Option B — client-side mammoth.js fallback:** `GET /:id/preview` returns the rendered `.docx` blob; the frontend uses `mammoth` to convert to HTML and renders inline. Lower fidelity (loses some styling) but no extra server dependency.

Spec defaults to **Option B** for now — it ships without infra changes. Swap to Option A later if fidelity becomes an issue.

The modal includes a "Download .docx" button as a fallback.

---

## 8. Validation summary (cross-cutting)

| Concern | Rule |
|---|---|
| Proposal # uniqueness | Server-enforced. 409 → "already exists, replace?" UX (§4.9). |
| Type immutability | Locked after first save. Frontend disables; backend rejects type changes. |
| Status transitions | Backend allows any → any in v1 (no FSM). The Accepted-prompt is UX only. |
| Delete with linked POs | Backend returns 409 with `{linked_pos: [...]}`; frontend shows count in toast. |
| Empty line items | Dropped on save. If all rows empty → validation error "Add at least one line item." |
| Missing tax rate match | Silently default to 0; no error. |
| Missing client lookup | Empty Address dropdown; required-field error if user tries to save without one. |

---

## 9. Edge cases worth coding tests for

These mirror the legacy VBA's quirks. Each one needs an explicit unit/integration test.

1. **Standard line item with empty Qty** → Amount = Rate (lump sum), not 0.
2. **Standard line item with Qty = 0** → Amount = 0 (zero is not the lump-sum branch).
3. **MP line item with empty Hourly Rate** → Estimated Fee = Hours Estimated.
4. **MP line item with Hourly Rate but empty Hours** → Estimated Fee = 0.
5. **Client Name with multiple Addresses** → Address dropdown enabled, other fields cleared.
6. **Client Name with single Address** → all contact fields autofill on Name selection.
7. **Save with duplicate Proposal #** → 409 → user confirms replace → prior record deleted, new one saved (mirror legacy `UpdateProposal`).
8. **Toggle Taxable off then on** → manual override flag resets, lookup re-applied.
9. **Type=MP, save with empty `services_provided`** → allowed (it's optional rich text, not required).
10. **Notes with Tier-1 markup only** → roundtrips through API and renders identically in view page.

---

## 10. Implementation checklist

Per the per-module pattern in implementation plan §6.

### Backend
- [ ] Alembic migration: `proposals`, `proposal_line_items`, `mp_destinations` (if not yet)
- [ ] Models: `Proposal`, `ProposalLineItem`, `MPDestination`
- [ ] Schemas: `ProposalCreate`, `ProposalUpdate`, `ProposalOut`, `ProposalListItem`, `LineItemIn`, `LineItemOut`
- [ ] Service: `proposal_service.py` — number generation, save (with replace flow), status transitions
- [ ] Routes: `proposals.py` — list/get/create/update/delete/status/generate/preview/next-number
- [ ] Routes: `clients.py` — add `/clients/lookup` if not present
- [ ] Routes: `tax_rates.py` — add `/tax-rates/lookup` if not present
- [ ] Routes: `mp_destinations.py` — list endpoint
- [ ] Doc generation wires both templates into the existing `DocxRenderer` service
- [ ] Tests: §9 list, plus role-based access (Viewer can read, can't mutate)
- [ ] Register routers in `app/main.py`

### Frontend
- [ ] Types: `frontend/src/types/proposal.ts`
- [ ] API hooks: `frontend/src/api/proposals.ts` (TanStack Query)
- [ ] API hooks: extend `clients.ts`, `taxRates.ts`, add `mpDestinations.ts`
- [ ] Composable: `useProposalForm.ts` — encapsulates the lookup + computed-field logic so it's testable in isolation
- [ ] Components:
  - [ ] `views/proposals/ProposalListView.vue`
  - [ ] `views/proposals/ProposalFormView.vue` (create/edit)
  - [ ] `views/proposals/ProposalDetailView.vue` (view)
  - [ ] `views/proposals/components/LineItemsTable.vue`
  - [ ] `views/proposals/components/TotalsCards.vue`
  - [ ] `views/proposals/components/StatusPopover.vue` (reusable for list + detail)
  - [ ] `views/proposals/components/DocPreviewModal.vue`
- [ ] Routes: add `/proposals`, `/proposals/new`, `/proposals/:id`, `/proposals/:id/edit` to `router/index.ts`
- [ ] Sidebar nav: add "Proposals" entry, role-gated
- [ ] Empty state, error states, skeleton loaders per implementation plan §15

### Smoke test (manual)

- [ ] Create Standard proposal end-to-end, generate doc, open in Word, verify all placeholders.
- [ ] Create MP proposal end-to-end, generate doc, verify `services_provided` renders.
- [ ] Edit existing, change Type — confirm it's locked.
- [ ] Status flow Draft → Sent → Accepted (accept prompt fires).
- [ ] Delete attempts with and without linked POs.
- [ ] Preview modal renders both types.

---

## 11. Open questions (carry-forward, not blockers)

1. **PO cascade target route.** This spec assumes `/purchase-orders/new?from_proposal=:id`. Confirm when PO feature is built.
2. **MP Destinations CRUD.** Out of scope here, but Settings → Lists needs an admin UI for it. Add to the Configuration spec.
3. **Doc preview implementation.** Default is mammoth.js (Option B). Revisit when the doc generation fidelity audit happens (implementation plan §8).

---

*End of spec.*
