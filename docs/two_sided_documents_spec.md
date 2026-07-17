# Two-Sided Documents — Spec

**Modules:** Sidebar restructure · Proposals (Issued + Received) · Purchase Orders (Received + Issued) · Invoices (Issued + Received)
**Surfaces:** Sidebar/nav · List views · Entry forms · Detail views
**Stack reference:** `Bookkeeping_Implementation_Plan.md`. Reuse existing base components and the patterns established in `proposal_feature_spec.md` (full-page forms, list view with composable filters, Job Code chips, status popover, mock-first API layer).
**Status:** Ready to implement (frontend, mock-driven — same as the Proposals module).

---

## 0. Background & domain model

The business runs two mirrored document flows (meeting notes 2026-05-12):

```
1. Clients side (income) — business owner ↔ client:
   Send Proposal  →  Receive a PO  →  Send an Invoice

2. Contractors side (expenses) — business owner ↔ subcontractor:
   Receive Proposal  →  Send a PO  →  Receive an Invoice
```

The two legacy Excel tools are the *same tool duplicated* — "Bookkeeping Tool V1 Main" for the clients side and "Outside Expenses Tool" for the contractors side. Their VBA is functionally identical (verified by diff — only variable-casing differences and unused empty UserForms). The web app replaces the duplication with a single app where every document carries a **direction**.

### 0.1 Direction model

One field drives everything:

```ts
export type DocDirection = 'issued' | 'received'
```

Direction alone determines which side a document belongs to — no second field needed:

| Document | `issued` = | `received` = |
|---|---|---|
| Proposal | Clients side (we send to client) | Contractors side (contractor sends to us) |
| Purchase Order | Contractors side (we send to contractor) | Clients side (client sends to us) |
| Invoice | Clients side (we bill the client) | Contractors side (contractor bills us) |

Supporting evidence from the legacy VBA: the PO form already has a `poType` field with values `Issued`/`Received`; `FillPOByProposal` only auto-populates when `poType = "Received"` (a client PO answers *our* proposal), and `GeneratePODocument` only runs when `poType <> "RECEIVED"` (you only generate documents you send). Every PO in the clients-side workbook's archive is `Received` — confirming the model. We generalize this pattern to all three document types.

**Direction is locked after first save** (same rule as proposal Type).

### 0.2 Direction-generic behaviors

| Behavior | `issued` documents | `received` documents |
|---|---|---|
| Document number | Auto-generated, year-prefixed (see §8) | **External** number typed from the counterparty's document. Free text, no pattern check. Unique per (doc type + direction). |
| Generate Document (.docx) | ✓ (see §9) | ✗ — hidden everywhere (list actions, detail header). There is nothing to generate; we received the file. |
| Doc Preview | ✓ | ✗ |
| Counterparty | Client (from `clients`) | Contractor — a **separate entity** per the backend ERD (`docs/erd.md`: `CLIENT` and `SUBCONTRACTOR` are distinct tables). Frontend v1: add `mocks/contractors.ts` + `api/contractors.ts` mirroring the clients mock shape; contractor-side comboboxes source from it. A Contractors settings/list page mirrors Clients later — out of scope here. |
| P&L classification | Income (proposals/invoices) | Expense/outgoing |

---

## 1. Sidebar restructure

### 1.1 New nav structure (`AppSidebar.vue` → `NAV_GROUPS`)

Replace the current single "Inputs" group with two counterparty groups. Six document entries total — two per document type, as required.

```
Overview                                  /

CLIENTS · INCOME
  Proposals          (issued)             /proposals/issued
  Purchase Orders    (received)           /pos/received
  Invoices           (issued)             /invoices/issued

CONTRACTORS · EXPENSES
  Proposals          (received)           /proposals/received
  Purchase Orders    (issued)             /pos/issued
  Invoices           (received)           /invoices/received
  Expenses                                /expenses

REPORTS
  Bookkeeping                             /bookkeeping
  P&L Report                              /pl

SETTINGS
  Clients                                 /clients
  Configuration      (admin only)         /settings
```

Notes:
- Group labels use the existing `sidebar__section-label` styling. Suggested labels: **"Clients · Income"** and **"Contractors · Expenses"** (or just "Clients" / "Contractors" if too long for the 220px sidebar — check truncation).
- The item labels stay short ("Proposals", "Purchase Orders", "Invoices") — the group provides the context. Do **not** label items "Proposals Issued" etc.; it bloats the rail tooltips and the labels would stutter under the group heading.
- Icons: reuse existing `icons.proposals/pos/invoices` for both groups. Optionally overlay a small ↗/↙ arrow variant later — not required for v1.
- `Expenses` moves into the Contractors group (it is the outgoing side — the legacy Outside Expenses tool is the contractors tool). Keep its route unchanged.
- Rail mode (600–899px) shows 11 icons; verify vertical scroll still works in `sidebar__nav` (it already has `overflow-y: auto`).
- `AppBottomNav.vue` (mobile): keep at most Overview + 4 items; put the six document lists behind the "More" drawer. Pick Overview, Proposals (issued), Invoices (issued), Expenses, More — adjust if the client disagrees.

### 1.2 Active-state matching

Nav items must highlight for child routes (e.g. `/proposals/issued` active when on `/proposals/:id` of an issued proposal). Simplest v1 rule: match on the list route only (exact-ish, current behavior). Improving detail-route highlighting is a polish item, not a blocker.

---

## 2. Routes

All list routes are direction-scoped. Detail/edit/new routes are direction-agnostic (the record knows its direction). **Register static segments before `:id` params.**

| Route | Page | Notes |
|---|---|---|
| `/proposals/issued` | Proposals list, filtered `direction=issued` | |
| `/proposals/received` | Proposals list, filtered `direction=received` | |
| `/proposals` | **Redirect** → `/proposals/issued` | Back-compat |
| `/proposals/new?direction=…` | Existing form; direction from query, default `issued` | |
| `/proposals/:id`, `/proposals/:id/edit` | Existing detail/form | Unchanged paths |
| `/pos/received` · `/pos/issued` | PO list per direction | |
| `/pos` | Redirect → `/pos/received` | Clients side is the primary flow |
| `/pos/new?direction=…` | PO form (create) | Role: admin/editor |
| `/pos/:id` · `/pos/:id/edit` | PO detail / edit | |
| `/invoices/issued` · `/invoices/received` | Invoice list per direction | |
| `/invoices` | Redirect → `/invoices/issued` | |
| `/invoices/new?direction=…` | Invoice form (create) | Role: admin/editor |
| `/invoices/:id` · `/invoices/:id/edit` | Invoice detail / edit | |

Cross-document deep links used by the linking flows (§7):

- `/pos/new?direction=received&from_proposal=:id` — create client PO from an accepted issued proposal (this is the target of the existing "Accepted → Create PO?" prompt in the proposal spec §4.9).
- `/pos/new?direction=issued&from_proposal=:id` — create sub PO from a received proposal.
- `/invoices/new?direction=issued&from_po=:id` — invoice a client PO.
- `/invoices/new?direction=received&from_po=:id` — record a contractor invoice against a sub PO.

Each list view is **one component per document type** taking direction from the route (prop or `route.meta.direction`), not six components. Same for forms.

---

## 3. Data model changes

### 3.1 Proposals (extend existing `types/proposal.ts`)

```ts
export type DocDirection = 'issued' | 'received'   // put in a shared types/common.ts

export interface Proposal {
  // …existing fields…
  direction: DocDirection            // NEW — default 'issued'; locked after save
  linked_client_po_id?: string       // NEW — received only, optional (§7)
  linked_owner_invoice_id?: string   // NEW — received only, optional (§7)
}
// ProposalListItem += direction
// ProposalListParams += direction: DocDirection  (required param — every list call is scoped)
```

Existing mock proposals get `direction: 'issued'`. Add received fixtures (both Standard and MP — **received proposals keep the two formats**, per requirements).

Status set differs by direction:

| Direction | Statuses | Default |
|---|---|---|
| issued | `Draft / Sent / Accepted / Declined` (unchanged) | Draft |
| received | `Received / Accepted / Declined` | Received |

(`Accepted` on a received proposal = we hire this contractor → prompt "Create a linked PO?" → `/pos/new?direction=issued&from_proposal=:id`. Mirrors the issued-side prompt.)

### 3.2 Purchase Orders (new `types/purchaseOrder.ts`)

Field source: legacy `poArchive` columns + PO entry form named ranges.

```ts
export type POStatus = 'Open' | 'Approved' | 'Fulfilled' | 'Canceled'  // code-owned enum (§3.4)
export type PaymentTerms = string  // admin-configurable list (§3.4); seed values:
                                   // Due On Receipt / Net 15 / Net 30 / Net 45 / Net 60

export interface POLineItem {
  id: string
  job_code: JobCode | null
  description: string
  qty: number | null          // "Qty/Hours"; null = lump-sum (amount = rate)
  rate: number
  amount: number              // computed: qty == null ? rate : qty * rate
}

export interface PurchaseOrder {
  id: string
  direction: DocDirection     // received = clients side, issued = contractors side
  number: string              // issued: PO-YY#### auto; received: client's PO number (external)
  status: POStatus
  date: string                // ISO

  proposal_id?: string        // linked proposal (received PO → our issued proposal;
  proposal_number?: string    //   issued PO → contractor's received proposal). Optional.

  client_name: string         // counterparty (client or contractor)
  address?: string
  project_no?: string
  agreement_no?: string
  ship_date?: string
  ship_to?: string
  payment_terms?: PaymentTerms

  taxable: boolean
  tax_rate: number
  subtotal: number            // Σ amounts
  sales_tax: number           // tax_rate × subtotal
  total: number               // subtotal + sales_tax

  line_items: POLineItem[]
  notes?: string              // Tier-1 rich text

  // contractors side only — engagement link (§7), both optional on POs:
  linked_client_po_id?: string
  linked_owner_invoice_id?: string

  created_at: string
  updated_at: string
}
```

Status notes: legacy data shows `Approved` as the live PO status; the legacy status list also has `Pending/Completed/Canceled`-family values. v1 set: **Open (default) / Approved / Fulfilled / Canceled**. Cancel-cascade to linked invoices is backend scope (implementation plan §7) — the frontend only shows a Confirm modal warning when canceling a PO that has linked invoices.

### 3.3 Invoices (new `types/invoice.ts`)

Field source: legacy `invoiceArchive` columns + invoice entry form named ranges.

```ts
export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Partially Paid' | 'Paid'
// legacy statusList: Unpaid / Part. Paid / Paid. 'Draft' applies to issued only.
// Overdue is NOT a status — it's a computed flag (see below).

export interface InvoiceLineItem {
  id: string
  job_code: JobCode | null
  description: string
  qty: number | null
  rate: number
  amount: number
}

export interface Invoice {
  id: string
  direction: DocDirection     // issued = clients side, received = contractors side
  number: string              // issued: INV-YY#### auto; received: contractor's invoice number
  status: InvoiceStatus
  date: string

  po_id?: string              // linked PO in the same chain
  po_number?: string
  proposal_id?: string
  proposal_number?: string

  client_name: string
  address?: string
  project_no?: string
  agreement_no?: string
  ship_date?: string
  payment_terms?: PaymentTerms

  taxable: boolean
  tax_rate: number
  subtotal: number
  sales_tax: number
  total: number
  payments_credits: number    // default 0
  // computed, never stored on the form:
  //   balance_due = total - payments_credits
  //   due_date    = date + paymentTermsDelay(payment_terms)   (legacy getDatePaid)
  //   is_overdue  = status !== 'Paid' && today > due_date

  line_items: InvoiceLineItem[]
  notes?: string

  // contractors side only — engagement link (§7). For received invoices
  // AT LEAST ONE of these two is REQUIRED (meeting notes 2026-05-12):
  linked_client_po_id?: string
  linked_owner_invoice_id?: string

  created_at: string
  updated_at: string
}
```

Payment terms delays (legacy `paymentTermsList`; an admin-configurable list per §3.4 — rows carry `delay_days`; these are the seed values):

| Term | Delay (days) |
|---|---|
| Due On Receipt | 0 |
| Net 15 / 30 / 45 / 60 | 15 / 30 / 45 / 60 |

> Legacy quirk, resolved: VBA `getDatePaid` writes `invoice date + delay` into a column named "Date Paid". Semantically that is the **due date**, not the paid date. The new model names it `due_date` (computed). Actual payment recording stays `payments_credits` + status.

### 3.4 Contractors, and admin-configurable dropdown lists (decision 2026-07-16)

Per the backend ERD (`docs/erd.md`) and meeting notes 2026-05-12:

- **Contractors** (`SUBCONTRACTOR` in the ERD) are a separate entity from clients. Frontend v1: `types` entry `Contractor` (same shape as `ClientContact` — the legacy Outside Expenses tool literally reuses the client table structure), `mocks/contractors.ts`, `api/contractors.ts` with the same lookup hook as clients. Every contractor-side counterparty combobox (received proposals, issued POs, received invoices) sources from contractors; client-side comboboxes keep sourcing from clients.

**Every dropdown option list in every form is dynamic, admin-managed from the Configuration page** — nothing hardcoded in components. This generalizes the legacy Setup sheet (jobCodeList, paymentTermsList, etc.) and the meeting notes ("add and delete categories — configuration list like in the Excel template", "settings for lists", "MP proposal: Reference field as dropdown").

Configurable lists in scope for these modules:

| List | Used by | Row shape |
|---|---|---|
| Job Codes | Proposal/PO/Invoice line items + filters | `{ id, label }` |
| Payment Terms | PO & Invoice forms, due-date computation | `{ id, label, delay_days }` |
| References | MP proposal form | `{ id, label }` |
| MP Destinations | MP proposal form (already an entity) | `{ id, final_destination, physical_address, city, state }` |

Frontend pattern (v1, mock-backed):

- One generic composable: `useConfigList(name)` → `{ options, isLoading }`, backed by `src/api/configLists.ts` (TanStack Query) over `src/mocks/configLists.ts`. Forms and filters consume **only** this hook — never import a constant array directly.
- The existing `JOB_CODES` const and `mocks/jobCodes.ts` become the *seed data* inside the mock config service (still a single source of truth; the additions-v2 rule "never hardcode the list in two places" carries over).
- **Type migration:** the `JobCode` 20-value string union (and `PaymentTerms` union in §3.2/§3.3) can't survive admin-editable lists — they become `string` aliases (`export type JobCode = string`). Validation is runtime against the fetched list, not compile-time. Do this migration in Phase 1 while the union has few consumers.
- Deleting/renaming a list value must not corrupt saved documents: saved docs store the label as entered; the config list only governs *new* selections. A saved doc whose job code was deleted from the list still displays it (render value as-is; combobox shows it as an "inactive" option when editing).
- Boundaries: **statuses, directions, and proposal Type (Standard/MP) stay code-owned enums** — application logic (cascades, overdue computation, doc-generation rules, direction locking) hangs off them. They are select inputs but not admin-configurable lists.
- Configuration page (admin-only, existing `/settings` route): a "Lists" section with one editable table per list above (add / rename / deactivate; delete only when unused or with the inactive-value behavior above). Full CRUD UI can land after the document modules — v1 forms only need the read path (`useConfigList`).

### 3.5 Mocks & API layer

Follow the exact pattern of `src/mocks/proposals.ts` + `src/api/proposals.ts`:

- `src/mocks/purchaseOrders.ts`, `src/mocks/invoices.ts`, `src/mocks/paymentTerms.ts`
- `src/api/purchaseOrders.ts`, `src/api/invoices.ts` (TanStack Query hooks: `usePOList`, `usePO`, `useCreatePO`, `useUpdatePO`, `useDeletePO`, `usePOStatus`, `useNextPONumber`; same family for invoices)
- Fixtures must cover: both directions; POs linked to existing mock proposals (standard *and* MP — legacy `FillPOByProposal` searches both archives); invoices linked to POs; a received invoice linked to an owner invoice (not a PO); multi-job-code line items; a canceled PO; an overdue unpaid invoice; empty line-item edge cases.

---

## 4. Purchase Order pages

### 4.1 List view (`views/purchase-orders/PurchaseOrdersListView.vue` — replace stub)

Mirror the Proposals list structure (header · filter row · DataTable · empty state · **Export shell button only — no Import on document lists, see §12**).

Columns:

| Column | Source | Notes |
|---|---|---|
| PO # | `number` | Bold, click → `/pos/:id` |
| Date | `date` | `MMM D, YYYY` |
| Client / Contractor | `client_name` | Header label depends on direction: "Client" (received) / "Contractor" (issued) |
| Proposal # | `proposal_number` | Link to proposal detail if `proposal_id` set; `—` otherwise |
| Job Codes | line items | Chips, max 3 + "+N more", column-header filter — same component/behavior as Proposals |
| Status | `status` | StatusBadge: Open gray, Approved blue, Fulfilled green, Canceled red. Click → status popover |
| Total | `total` | Right-aligned currency |
| Actions | | Edit · Generate Document (**issued only**) · Delete |

Filters (all interactive, composing, same mechanics as Proposals): Status (multi) · Date range · Client (combobox) · Job Code (multi, OR) · Search (PO #, Proposal #, client name). No Type filter (POs have one format). Direction is fixed by the route — **not** a filter.

### 4.2 Entry form (`/pos/new`, `/pos/:id/edit`) — full page

Header section fields (`*` required; source: legacy PO entry named ranges):

| # | Field | Type | Notes |
|---|---|---|---|
| 1 | Date * | date | Default today |
| 2 | PO # * | text | Issued: prefilled from `GET /pos/next-number`, editable, advisory pattern `^PO-\d{6}$`. Received: empty, free text ("client's PO number"), no pattern check. |
| 3 | Status | select | Default Open |
| 4 | Proposal # | combobox | Options: received direction → issued proposals; issued direction → received proposals. Selecting triggers autofill (§4.4). Optional. |
| 5 | Client/Contractor Name * | combobox | Received → clients list; issued → contractors list (§3.4). Same lookup behavior as proposal form §4.7.1 (address dropdown, contact autofill) |
| 6 | Address * | combobox/text | Same as proposal form |
| 7 | Project No. | text | |
| 8 | Agreement No. | text | |
| 9 | Ship Date | date | Optional |
| 10 | Ship To | text | Optional |
| 11 | Payment Terms | select | From payment-terms list |

Issued POs additionally show an **Engagement link** section (§7): Client PO (combobox of received POs) and Owner Invoice (combobox of issued invoices) — both optional.

Line items: identical table to the Standard proposal variant (Job Code select · Description · Qty/Hours · Rate · computed Amount · ✕), same lump-sum formula, same add-row/tab behavior. Tax & Totals and Notes (Tier-1 RTE) sections: identical to the proposal form. Taxable default Yes.

Validation (mirrors legacy `mandatoryFields` = poDate, poNumber, poClientName, poEntryTable[Description]): Date, PO #, Client Name, ≥1 line item with Description. Duplicate-number 409 → "already exists, replace?" flow, same as proposals.

### 4.3 Detail view (`/pos/:id`)

Mirror `ProposalDetailView` layout: read-only form + header actions (Edit · Generate Doc + Preview **issued only** · Delete · status chip popover). Add a **Linked documents** card: linked proposal, linked invoices (invoices whose `po_id` is this PO), and engagement links — each a router-link.

Delete guard: blocked (409 + toast) if invoices link to this PO.

### 4.4 Autofill from proposal (legacy `FillPOByProposal`)

On Proposal # selection (form-local, overwrites current fields after a dirty-check confirm):

- Copies from the proposal: Client Name, Address, Project No., Agreement No., Taxable, Tax Rate, Notes — and for MP proposals: Address, Project No., Taxable, Tax Rate, Notes (no client name — MP has none; user fills contractor manually).
- Line items map: Standard → `job_code, description, qty(from Est. Qty/Hours), rate`; MP → `job_code ("Medical Physics Services"), description(from Services), qty(from Hours Estimated), rate(from Hourly Rate)`. Amounts recompute.
- Existing rows are replaced (legacy clears the items table first).
- `?from_proposal=:id` triggers the same autofill on mount.

---

## 5. Invoice pages

### 5.1 List view (`views/invoices/InvoicesListView.vue` — replace stub)

Columns:

| Column | Source | Notes |
|---|---|---|
| Invoice # | `number` | Bold, click → detail |
| Date | `date` | |
| Client / Contractor | `client_name` | Label per direction |
| PO # | `po_number` | Link if `po_id`; `—` otherwise |
| Job Codes | line items | Same chips + header filter |
| Status | `status` + overdue | StatusBadge: Draft gray, Unpaid amber, Partially Paid blue, Paid green. If `is_overdue`, show an additional red "Overdue" chip next to the status. |
| Total | `total` | Right-aligned |
| Balance | computed | Right-aligned; `—` when Paid |
| Actions | | Edit · Generate Document (**issued only**) · Mark Paid (quick action) · Delete |

Filters: Status (multi, incl. a virtual "Overdue" option) · Date range · Client · Job Code · Search (Invoice #, PO #, client name).

**Mark Paid** quick action: ConfirmModal → sets `payments_credits = total`, `status = 'Paid'`.

### 5.2 Entry form (`/invoices/new`, `/invoices/:id/edit`) — full page

Header fields (source: legacy invoice entry named ranges — invoiceDate, invoiceNumber, invoicePONumber, invoiceProposalNumber, invoiceClientName/Title/BusinessName/Dept/Phone/Email, invoiceAddress, invoiceProjectNumber, invoiceAgreementNumber, invoiceShipDate, invoicePaymentTerms, invoicePaymentsCredits):

| # | Field | Type | Notes |
|---|---|---|---|
| 1 | Date * | date | |
| 2 | Invoice # * | text | Issued: auto `INV-YY####`, advisory pattern. Received: external, free text. |
| 3 | Status | select | Issued default Draft; received default Unpaid |
| 4 | PO # | combobox | Issued → received POs; received → issued POs. Triggers autofill (§5.3). |
| 5 | Proposal # | combobox | Auto-set by PO autofill; manually selectable when no PO |
| 6 | Client/Contractor Name * | combobox | Issued → clients list; received → contractors list (§3.4). Lookup autofill incl. Title/Business/Dept/Phone/Email (issued invoices print these — see placeholder map §10) |
| 7 | Address * | combobox/text | |
| 8 | Project No. / Agreement No. / Ship Date | text/date | |
| 9 | Payment Terms | select | Drives computed Due Date, displayed read-only next to it |
| 10 | Payments/Credits | currency | Default 0. Editing recomputes Balance Due and suggests status (0 → Unpaid, 0<x<total → Partially Paid, ≥total → Paid) — suggestion only, user can override. |

**Received invoices — Engagement link section (REQUIRED):** Client PO (received POs combobox) *or* Owner Invoice (issued invoices combobox). Validation error if both empty: *"Link this contractor invoice to a Client PO or one of your Invoices."* (Meeting notes 2026-05-12 — mandatory for sub invoices.)

Line items, Tax & Totals, Notes: identical to PO form. Extra totals cards: **Payments/Credits** and **Balance Due** (`total - payments_credits`).

Validation (legacy mandatory: invoiceDate, invoiceNumber, invoiceClientName, Description): Date, Invoice #, Client Name, ≥1 line item; + engagement link rule for received. Duplicate-number replace flow as elsewhere.

### 5.3 Autofill from PO (legacy `FillInvoiceByPO`)

On PO # selection: copy Proposal #, Client Name, Address, Project No., Agreement No., Ship Date, Payment Terms, Taxable, Tax Rate, Notes + all line items (job_code, description, qty, rate; amounts recompute). Replaces existing rows after dirty-check confirm. `?from_po=:id` autofills on mount.

### 5.4 Detail view (`/invoices/:id`)

Read-only form + actions (Edit · Generate/Preview issued-only · Mark Paid · Delete · status popover). Linked-documents card: PO, proposal, engagement links, and — for issued invoices — received invoices that reference it via `linked_owner_invoice_id`.

---

## 6. Received Proposals (contractors side)

Smallest module — the Proposals feature already exists; this parametrizes it.

- `/proposals/received` renders the same `ProposalsListView` with `direction=received`. Column tweak: "Client / Project" header reads "Contractor / Project". Everything else (Job Codes column, filters, Export shell) identical. **Remove the Import shell button from the proposals list** — deviation from `claude_code_prompt_proposal_additions_v2.md`, superseded by the §12 policy.
- Form: same `ProposalFormView`, both formats (Standard/MP) selectable — received proposals keep the two-format model. Differences in received mode:
  - Counterparty combobox sources from **contractors** (§3.4), not clients.
  - Proposal # is external free text (no `Q-`/`PQ-` prefill, no pattern warning).
  - Status select shows `Received / Accepted / Declined`.
  - Optional **Engagement link** section (Client PO / Owner Invoice — both optional, per meeting notes).
  - No Generate/Preview Document actions anywhere.
- Status → `Accepted` prompt: "Create a linked PO for this contractor?" → `/pos/new?direction=issued&from_proposal=:id`.
- `useProposalForm` gains a `direction` input; lookup/computed logic unchanged.

---

## 7. Linking rules (consolidated)

Within-chain links (dashed = optional):

```
Clients side:    Proposal(issued) ←─ PO(received) ←─ Invoice(issued)
Contractors side: Proposal(received) ←╌ PO(issued) ←╌ Invoice(received)
```

Cross-side "engagement links" — tie contractor spending to the client engagement it serves (meeting notes 2026-05-12):

| Contractor document | Link to Client PO (received) or Owner Invoice (issued) |
|---|---|
| Invoice (received) | **Mandatory — at least one** |
| PO (issued) | Optional |
| Proposal (received) | Optional |

Rules:
- Link pickers only offer documents of the correct type + direction.
- Deleting a document that others link to → 409 with the linked list; frontend shows the count in the error toast (same UX as proposal-with-POs).
- Canceling a PO with linked invoices → ConfirmModal warns "N linked invoice(s) will be canceled" (cascade executes backend-side; in mocks, set the linked invoices' status to reflect it).

---

## 8. Document numbering

Issued documents (server-side at create; `GET /:module/next-number` preview endpoint, mock = max+1 over fixtures):

| Document | Prefix | Example |
|---|---|---|
| Proposal (Standard) | `Q-` | Q-260042 |
| Proposal (MP) | `PQ-` | PQ-260008 |
| Purchase Order | `PO-` | PO-260013 |
| Invoice | `INV-` | INV-260031 |

Scheme (legacy `GenerateDocNumber`): `PREFIX + YY + ####`, counter starts at `YY0001` each year, first free number wins. Numbers editable; uniqueness enforced per (type + direction); pattern check advisory.

Received documents: external numbers, free text, unique per (type + direction); duplicate → same "replace?" flow.

---

## 9. Document generation matrix

| Document | Generate .docx? | Template |
|---|---|---|
| Proposal issued (Standard) | ✓ | `templates/Proposal_Template.docx` |
| Proposal issued (MP) | ✓ | `templates/MP_Proposal_Template.docx` |
| Proposal received | ✗ | — |
| PO issued | ✓ | `templates/PO_Template.docx` |
| PO received | ✗ | — (legacy: `If UCase([poType]) <> "RECEIVED" Then GeneratePODocument`) |
| Invoice issued | ✓ | `templates/Invoice_Template.docx` |
| Invoice received | ✗ | — |

Frontend v1 (mocks): the Generate button downloads nothing yet — wire the binary-fetch/blob pattern but stub the endpoint; keep the button functional-looking per module pattern. (Or hide behind the same shell approach as Export/Import — decide at build time, note it in the PR.)

---

## 10. Placeholder map (templates ⇄ data) — audit of current state

The templates in `/templates` were hand-updated (Jul 2026) and **no longer match the legacy VBA placeholders**. Current ground truth, extracted from the .docx files:

### 10.1 Invoice_Template.docx — fully converted to `{{…}}`

`InvoiceDate, InvoiceNumber, ClientName, ClientTitle, BusinessName, ClientDept, ClientPhone, ClientEmail, ClientAddress, ProjectNumber, AgreementNumber, ShipDate, PONumber, PaymentTerms, NotesTitle, Note, Subtotal, TaxRate, SalesTax, Total, Credits, BalanceDue`

(VBA used `<<Project #>>`, `<<Agreement #>>`, `<<Ship Date>>`, `<<PO #>>`, `<<Payment Terms>>` — the template renamed these to the clean forms above.)

### 10.2 PO_Template.docx — fully converted

`PODate, PONumber, ShipTo, ClientName, Address, NotesTitle, Note, Subtotal, TaxRate, SalesTax, Total`

### 10.3 Proposal_Template.docx — fully converted

`ProposalDate, ProposalNumber, ClientName, ClientTitle, BusinessName, ClientDept, ClientPhone, ClientEmail, ClientAddress, ProjectNumber, ProjectName, AgreementNumber, ValidTill, NotesTitle, Note, Subtotal, TaxRate, SalesTax, Total`

(VBA had trailing-space quirks — `<<ProjectName >>`, `<<AgreementNumber >>`, `<<ValidTill >>` — now normalized.)

### 10.4 MP_Proposal_Template.docx — resolved (decision 2026-07-16)

Current template state: converted `{{Date}}, {{Total}}, {{ServicesProvided}}`; legacy `<<Reference>>, <<ProjectName>>, <<ProjectLocation>>, <<Address>>, <<ProjectNumber>>, <<ProjectType>>` remain inside a text box; `ProposalNumber` placeholder no longer exists.

**Decision:** MP doc generation fills **only** `{{Date}}`, `{{Total}}`, `{{ServicesProvided}}` and the items table. The header details (reference, project name/location/address/number/type) and any proposal-number mention are **entered by the tool user, with formatting, in the Services Provided rich-text editor** — they flow into `{{ServicesProvided}}`. The template's leftover `<<…>>` text-box placeholders get deleted from the .docx in a one-time manual cleanup (no code involved); no programmatic filling of the text box, ever — which also sidesteps docxtpl's unreliability inside floating shapes.

Frontend implication: the MP Services Provided RTE is the primary authoring surface for the doc body — the meeting note "add different list points (e.g. bullets, square…)" applies here. Extend the Tier-1 toolbar **for this field** with ordered lists and square-bullet variants (TipTap list extensions; still no colors/fonts/tables). The MP header form fields (Reference, Project Location, etc.) are still stored as data for lists/filters/reports — they just don't drive the doc template anymore.

Remaining backend to-dos (out of scope for the frontend build):
1. All four templates still have **static line-item tables** (legacy filled them via the `itemsTable` Word bookmark). docxtpl needs a `{%tr for item in line_items %}` row in each. Not visible in a placeholder scan — must be added.
2. Naming: the implementation plan locked `snake_case` placeholders, but the updated templates use PascalCase. Recommendation: keep the templates' PascalCase and adapt the docxtpl context keys — the templates are client-facing and already redone; renaming code keys is cheaper than re-editing four documents.
3. `ServicesProvided`: per proposal spec §4.5 this comes from the user-edited rich-text field, **not** regenerated from line items (the legacy VBA built a numbered list from the Services column — deliberately replaced, and now load-bearing per the decision above).
4. `NotesTitle` conditional (legacy prints "Notes :" only when a note exists) → becomes `{% if note %}` in docxtpl; frontend unaffected.

---

## 11. API contract (for the future backend; mocks implement the same shapes)

Per module (`/api/v1/pos`, `/api/v1/invoices`; proposals extend existing):

| Method | Path | Notes |
|---|---|---|
| GET | `/pos?direction=&status[]=&client=&from=&to=&job_code[]=&q=&page=&page_size=` | direction required |
| GET/POST/PATCH/DELETE | `/pos`, `/pos/:id` | PATCH replaces `line_items` wholesale (proposal convention) |
| PATCH | `/pos/:id/status` | Cancel cascade side effects documented in response |
| POST | `/pos/:id/generate-document` | 422 if `direction=received` |
| GET | `/pos/next-number` | Issued preview only |
| — | same family for `/invoices` | + `PATCH /invoices/:id/mark-paid` |
| GET | `/proposals?…&direction=` | Add direction param |

Roles unchanged: Admin/Editor mutate, Viewer read-only.

---

## 12. Import / Export policy (decision 2026-07-16)

**Export: everywhere. Import: master lists only — never documents.**

| Surface | Export | Import |
|---|---|---|
| Proposals / POs / Invoices (all six lists) | ✓ CSV (respects active filters; line items flattened one-row-per-item, legacy-archive style) | ✗ — button does not exist |
| Clients · Contractors · Tax Rates | ✓ | ✓ |
| Config lists (Job Codes, Payment Terms, References, MP Destinations — §3.4) | ✓ | ✓ (from the Configuration page) |
| Expenses | ✓ | ✓ (explicitly requested in meeting notes 2026-04-02: "export and import of outside expenses") |
| Bookkeeping / P&L | ✓ (bookkeeper export is its own feature, implementation plan §8) | ✗ |

Rationale: documents are linked financial records — numbers with uniqueness + replace semantics, cross-document links, derived totals feeding the bookkeeping table and P&L. A malformed batch import can silently corrupt financial history; a malformed client list import at worst mis-fills a combobox. Master lists are flat, easily previewed, and easily re-imported.

Import UX for the allowed lists: reuse the existing Clients pattern (`clientsIO.ts` + `ImportPreviewModal`) — parse → validate → preview with per-row status (new / update / error) → explicit confirm → apply. No silent partial writes. Admin-only (matches the proposals-additions role gating: Export = Admin+Editor, Import = Admin).

**One-time legacy data load is not an import feature.** Migrating the two .xlsm archives (proposals, POs, invoices, expenses) happens via the Phase-7 migration script with reconciliation checks (implementation plan §9) — script-driven, run against staging first, never through the UI.

If batch document import is ever genuinely needed (v2+ — e.g. a client that sends PO batches electronically), the safe shape is documented in §15 (open questions) — quarantine pipeline, not a CSV upload.

---

## 13. Edge cases worth tests

1. PO line item with empty Qty → Amount = Rate (lump-sum); Qty = 0 → Amount = 0. (Same legacy formula as proposals.)
2. Received invoice saved with no engagement link → validation error; with only Owner Invoice (no PO) → valid.
3. Issued invoice `payments_credits` edits: 0 → suggests Unpaid; partial → Partially Paid; ≥ total → Paid; user override sticks.
4. `is_overdue`: Unpaid + `date`=Jun 1 + Net 30 + today=Jul 16 → overdue chip shown; Paid + past due date → no chip.
5. PO autofill from an **MP** proposal maps Services→Description, Hours→Qty, Hourly Rate→Rate (legacy searches both archives).
6. Autofill overwrite: dirty form + selecting a Proposal/PO → confirm modal before replacing rows.
7. Direction lock: editing any saved document never offers a direction change; `?direction=` on an edit route is ignored.
8. Received documents: no Generate/Preview action in list or detail; external number `"4500123977"` accepted without pattern warning.
9. Delete PO with linked invoice → 409 toast with count; cancel PO with linked invoice → warning modal, then cascade.
10. `/proposals`, `/pos`, `/invoices` redirect to their default direction lists; sidebar highlights the right entry.
11. Number uniqueness is per type+direction: issued invoice `INV-260001` and received invoice `INV-260001` may coexist.

---

## 14. Implementation checklist (suggested build order)

### Phase 1 — Shared plumbing
- [ ] `types/common.ts`: `DocDirection`; `JobCode`/`PaymentTerms` union → `string` migration (§3.4)
- [ ] Config-list infrastructure: `useConfigList(name)` composable, `api/configLists.ts`, `mocks/configLists.ts` seeded with Job Codes / Payment Terms / References / MP Destinations (§3.4); refactor existing forms and filters off the `JOB_CODES` const
- [ ] Contractors entity: `mocks/contractors.ts`, `api/contractors.ts` (§3.4)
- [ ] MP Reference dropdown wired to `useConfigList('references')` in the MP proposal form
- [ ] Proposal type/mocks/api: add `direction` (+ received fixtures, received statuses)
- [ ] Router: all routes + redirects (§2); one list/form/detail component per doc type, direction-parametrized
- [ ] Sidebar: new `NAV_GROUPS` (§1); bottom-nav adjustments

### Phase 2 — Proposals received
- [ ] List/form/detail direction handling (§6); accepted-prompt → sub-PO route
- [ ] Remove Import shell button from the proposals list (§12 policy); keep Export

### Phase 3 — Purchase Orders
- [ ] `types/purchaseOrder.ts`, mocks, api hooks
- [ ] `PurchaseOrdersListView` (replace stub), `POFormView`, `PODetailView` + reuse `LineItemsTable`/`TotalsCards`/`StatusPopover`/`DocPreviewModal` from proposals (lift to a shared folder, e.g. `components/documents/`)
- [ ] Proposal autofill (§4.4); engagement-link section

### Phase 4 — Invoices
- [ ] `types/invoice.ts`, mocks, api hooks
- [ ] `InvoicesListView` (replace stub), `InvoiceFormView`, `InvoiceDetailView`
- [ ] PO autofill (§5.3); payments/balance/due-date/overdue logic; Mark Paid; engagement-link validation

### Phase 5 — Cross-links & polish
- [ ] Linked-documents cards on all three detail views
- [ ] Accepted-proposal → PO prompt wiring both directions; `from_proposal`/`from_po` mount autofill
- [ ] Smoke test the full chains: issue proposal → receive PO → issue invoice; receive proposal → issue PO → receive invoice (with mandatory engagement link)
- [ ] `pnpm build` clean; update this spec with any deviations

---

## 14b. Build status (frontend, mock-driven) — updated 2026-07-17

Execution-plan Phases 1–7 are complete and building green (`pnpm --filter frontend build`). Note the plan renumbers this spec's §14 order: plan Phase 5 = Purchase Orders, plan Phase 6 = Invoices, plan Phase 7 = cross-links.

**Implemented**
- Direction model, config-lists infra, contractors entity, six-entry nav, routes/redirects (Phases 1–2).
- Proposals: issued + received, direction-aware statuses, received engagement-link section now **live** (Client PO / Owner Invoice comboboxes), accepted→PO prompt (Phases 3, 7).
- Shared `components/documents/` (LineItemsTable, TotalsCards, StatusPopover, DocPreviewModal) (Phase 4).
- Purchase Orders: full List/Form/Detail, proposal autofill (§4.4 incl. MP mapping), `?from_proposal` mount autofill, issued-only Generate Doc, cancel-with-linked-invoices warning, delete guard (Phase 5).
- Invoices: full List/Form/Detail, PO autofill (§5.3), `?from_po` mount autofill, payments/credits→status suggestion, computed Due Date + overdue chip (§13.4), Mark Paid, mandatory engagement-link validation for received invoices (§5.2) (Phase 6).
- Cross-links: linked-documents cards on all three detail views + proposal detail; PO delete-guard/cancel-cascade wired to the invoices store (Phase 7).

**Deviations from spec text (all intentional, mock-stage)**
- §7 delete-guard / cancel-cascade "error toast" → surfaced via `ConfirmModal` instead; the app has no `ToastService` installed. Cascade itself stays backend scope (§3.2) — invoices have no `Canceled` status, so linked invoices are **not** mutated in the mock; the frontend only warns.
- §9 Generate Document → downloads a `text/plain` stub blob (real .docx needs the backend), consistent with the §9 "downloads nothing yet" allowance.
- Document list views are functional but omit the Proposals list's column show/hide + drag-reorder polish (not required by §4.1/§5.1).
- Config-list CRUD UI (Settings → Lists) is follow-up Phase 9; document forms use the read path (`useConfigList`) only.

**Backend handoff / known gaps:** real doc generation (§9/§10), config-list + document REST APIs (§11), one-time legacy data load (§12), and cancel-cascade side effects (§3.2/§7) all await the FastAPI backend.

---

## 15. Open questions (carry-forward, not blockers)

1. **PO status vocabulary** — legacy live data only shows `Approved`; proposed set Open/Approved/Fulfilled/Canceled needs client confirmation.
2. **Received-document file attachments** — the meeting notes mention `.docx import`; attaching the counterparty's original PDF/docx to received documents is a natural v2 feature. Not in this spec.
3. **Bottom-nav item selection** for mobile (§1.1) — confirm the 4 chosen shortcuts.
4. **JOB entity granularity** — the ERD models `JOB` as an entity linked many-to-many to proposals/POs/invoices/subcontractors; the frontend currently treats job codes as a fixed tag list (`JOB_CODES`). Fine for v1 mocks; revisit when the backend lands whether jobs become first-class records (title + description) with their own admin page.
5. **Batch document import (v2+, only if a real recurring need appears).** Not a CSV upload. The safe shape: accepts only the app's own export format (schema-versioned header); staged pipeline parse → validate → dry-run preview per row (create / skip / error) → transactional all-or-nothing apply; conflicts always **skip** (never the delete-and-replace semantics of the legacy tool); all derived fields (amounts, totals, tax, due dates) recomputed server-side with imported values used only as reconciliation warnings; imported documents land as Draft/quarantine with no cascades fired; every row tagged with an `import_batch_id` so a whole batch can be rolled back in one action; admin-only, audit-logged, with a downloadable import report.

Resolved since first draft (2026-07-16):
- ~~Contractor list separation~~ → contractors are a separate entity per the ERD; frontend adds contractor mocks/comboboxes (§3.4).
- ~~MP template repairs~~ → no repair; the tool user authors the MP doc body in the Services Provided rich-text editor (§10.4).

---

*End of spec.*
