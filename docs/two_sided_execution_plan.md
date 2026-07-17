# Two-Sided Documents — Execution Plan

**Implements:** `docs/two_sided_documents_spec.md` (frontend only, mock-driven)
**How to use:** run one phase per session/prompt — say **"/build-phase N"** (the `build-phase` skill) or paste the phase block into Claude Code. Never run two phases in one go. Every phase ends with a green `pnpm --filter frontend build`, a short report, and a STOP.

Why this shape: each phase is independently shippable and reversible. If a phase goes wrong, you discard one small diff — not a 40-file rewrite. Refactors (Phase 4) are isolated from feature work so regressions have one obvious cause.

**Global constraints (apply to every phase, in addition to CLAUDE.md):**
- Frontend only. No backend, no wrangler changes, no new dependencies.
- Don't touch files outside the phase's "Files" list; report instead.
- Keep the existing Proposals module working at every phase boundary.
- Update `two_sided_documents_spec.md` inline when reality forces a deviation.

---

## Phase 0 — Pre-flight audit (no code)

**Goal:** verify the spec's assumptions against the current code before anything changes.

**Do:**
1. Read spec §0–§3; read `router/index.ts`, `AppSidebar.vue`, `types/proposal.ts`, `mocks/*`, `api/*`, `views/proposals/**`, `useProposalForm.ts`.
2. Produce a gap report: (a) every file the plan will touch and why; (b) any spec assumption the code contradicts; (c) the current consumers of `JOB_CODES` and the `JobCode`/`PaymentTerms` unions (these get migrated in Phase 1).
3. No file modifications. Output the report and stop.

**Exit:** user approves the gap report (or amends the spec first).

---

## Phase 1 — Shared foundations (invisible to the UI)

**Goal:** the type system and data plumbing every later phase needs. Zero visual change.

**Spec refs:** §0.1, §3.1 (types only), §3.4, §3.5.

**Files:** `src/types/common.ts` (new), `src/types/proposal.ts`, `src/mocks/configLists.ts` (new), `src/mocks/contractors.ts` (new), `src/mocks/jobCodes.ts`, `src/api/configLists.ts` (new), `src/api/contractors.ts` (new), `src/composables/useConfigList.ts` (new), existing consumers of `JOB_CODES` (from the Phase 0 report).

**Do:**
1. `types/common.ts`: `DocDirection`; re-export point for shared doc types.
2. Config-list infra: `useConfigList(name)` composable → `api/configLists.ts` (TanStack Query) → `mocks/configLists.ts` seeded with Job Codes (the existing 20), Payment Terms (+`delay_days`), References, MP Destinations. `mocks/jobCodes.ts` re-exports from the seed so nothing holds a second copy.
3. Migrate `JobCode` and `PaymentTerms` unions → `string` aliases; switch every dropdown/filter consumer to `useConfigList`. (Runtime validation against the fetched list where the union previously guaranteed values.)
4. `Proposal`/`ProposalListItem`/`ProposalListParams` gain `direction` (default `'issued'` everywhere); all existing fixtures get `direction: 'issued'`. Add `linked_client_po_id`/`linked_owner_invoice_id` fields (unused for now).
5. Contractors entity: type + mocks + api hook mirroring clients.

**Exit criteria:** build green; app looks and behaves exactly as before (manually verify proposals list + form dropdowns still populate); no component imports an options array directly anymore.

---

## Phase 2 — Routes & sidebar

**Goal:** the six-entry navigation skeleton, with existing pages reachable at new paths.

**Spec refs:** §1, §2.

**Files:** `router/index.ts`, `components/layout/AppSidebar.vue`, `components/layout/AppBottomNav.vue`, `views/proposals/ProposalsListView.vue` (direction prop only), stub views for POs/invoices (retitle per direction).

**Do:**
1. Routes per spec §2: direction-scoped lists, redirects from `/proposals`, `/pos`, `/invoices`; static segments before `:id`. List routes pass `direction` via `route.meta`.
2. `ProposalsListView` accepts direction from meta and passes it to the list query (fixtures are still all issued — received list shows the empty state; correct for now).
3. PO/Invoice stub views read direction from meta and show "Purchase Orders (received) — coming soon" style titles, so all six routes are visibly distinct.
4. Sidebar `NAV_GROUPS` per §1.1; Expenses moves into the Contractors group. Bottom nav per §1.1.

**Exit criteria:** build green; all six entries navigate; redirects work; rail/drawer modes not clipped (11 items); proposals list unchanged under `/proposals/issued`.

---

## Phase 3 — Proposals: received mode

**Goal:** the contractor-side proposal experience, complete.

**Spec refs:** §6, §3.1 (statuses), §8 (external numbers), §12 (remove Import button).

**Files:** `views/proposals/**`, `composables/useProposalForm.ts`, `mocks/proposals.ts`, `api/proposals.ts`, `types/proposal.ts` (statuses only).

**Do:**
1. Direction-aware statuses (issued: Draft/Sent/Accepted/Declined; received: Received/Accepted/Declined) in form, status popover, list badges, filters.
2. Received form mode: contractor combobox (from Phase 1 contractors api), external free-text number (no prefill/pattern), optional engagement-link section (Client PO / Owner Invoice comboboxes — sourced from PO/invoice mocks; acceptable to land as disabled placeholders until Phases 5–6 provide data, note it in the report).
3. MP Reference field → `useConfigList('references')` ComboSelect with free-entry fallback (both directions).
4. Hide Generate/Preview Document for received proposals (list actions + detail header).
5. Accepted-status prompt routes by direction (`/pos/new?direction=received|issued&from_proposal=:id` — target route exists as stub from Phase 2).
6. Remove the Import shell button from the proposals list; keep Export.
7. Add received fixtures: ≥2 Standard + ≥2 MP received proposals.

**Exit criteria:** build green; full received-proposal CRUD flow works against mocks; issued flow regression-checked (create/edit/status/list filters).

---

## Phase 4 — Extract shared document components (refactor only, NO new features)

**Goal:** lift the pieces POs and Invoices will reuse. Behavior must be pixel-identical.

**Spec refs:** §14 Phase-3 note ("lift to a shared folder").

**Files:** `views/proposals/components/*` → `src/components/documents/` (LineItemsTable, TotalsCards, StatusPopover, DocPreviewModal + whatever the Phase 0 audit flagged as reused), import updates in proposal views.

**Do:** move + generalize props (e.g. LineItemsTable takes a column config instead of proposal-specific assumptions). No logic changes. If generalizing forces a behavior decision, stop and ask.

**Exit criteria:** build green; proposals (both directions, both formats) manually verified unchanged; no file in `views/proposals` imports from its old local `components/` for the moved pieces.

---

## Phase 5 — Purchase Orders module

**Goal:** complete PO module, both directions.

**Spec refs:** §3.2, §4, §7, §8; list patterns from §4.1.

**Files:** `types/purchaseOrder.ts` (new), `mocks/purchaseOrders.ts` (new), `api/purchaseOrders.ts` (new), `views/purchase-orders/*` (replace stub: ListView, FormView, DetailView), `router/index.ts` (form/detail routes if not landed in Phase 2).

**Do:** follow the spec sections in order — types/mocks/api first (fixtures per §3.5: both directions, links to existing proposal fixtures incl. MP, a canceled PO), then list, form (proposal autofill §4.4, engagement links for issued), detail (linked-documents card). Export shell button; no Import. Generate Document issued-only (stub download per §9).

**Exit criteria:** build green; smoke: create received PO from accepted issued proposal (autofill fills header + items, MP mapping per §4.4), edit, status popover, cancel-with-linked-invoices warning (mock), delete guard toast; issued PO with engagement links saves.

---

## Phase 6 — Invoices module

**Goal:** complete Invoice module, both directions.

**Spec refs:** §3.3, §5, §7, §8.

**Files:** `types/invoice.ts` (new), `mocks/invoices.ts` (new), `api/invoices.ts` (new), `views/invoices/*` (replace stub), router additions.

**Do:** same order as Phase 5. Extra logic: payments/credits with status suggestion, computed `balance_due`/`due_date` (from config-list payment terms `delay_days`)/`is_overdue` chip, Mark Paid quick action, PO autofill (§5.3), **mandatory engagement link validation for received invoices** (§5.2). Fixtures: overdue unpaid, partially paid, received invoice linked to owner-invoice-only.

**Exit criteria:** build green; smoke: issue invoice from received PO end-to-end; received invoice blocked from saving without engagement link, saves with either link; Mark Paid; overdue chip logic per §13.4.

---

## Phase 7 — Cross-links, wiring & final sweep

**Goal:** everything that spans modules; close the loop.

**Spec refs:** §7, §13 (full edge-case list), §14 Phase 5.

**Files:** the three detail views, form views (mount-time `from_proposal`/`from_po` autofill), engagement-link comboboxes left as placeholders in Phase 3.

**Do:**
1. Linked-documents cards complete on all three detail views (both directions of links).
2. `from_proposal`/`from_po` query params trigger autofill on mount with dirty-check.
3. Enable the Phase-3 engagement-link placeholders on received proposals.
4. Walk the two full chains manually: issue proposal → receive PO → issue invoice; receive proposal → issue PO → receive invoice (mandatory link).
5. Run every §13 edge case as a manual check; fix what fails.
6. Reconcile the spec: mark implemented sections, record deviations, refresh §15 open questions.

**Exit criteria:** build green; both chains demo-able end-to-end on mocks; spec updated; report includes a "known gaps / backend handoff" list.

---

## Follow-up phases (8–11) — after Phase 7 is checkpointed

Specced in `docs/followup_features_spec.md`. Same rules: one phase per session, build green, checkpoint, stop. Order is deliberate — Phase 8 creates the generalized IO util that 9 and 10 reuse.

### Phase 8 — Contractors settings page

**Spec:** followup spec §1. **Files:** `views/contractors/*` (new, copy-adapt from `views/clients/`), `utils/partyIO.ts` (new, generalized from `clientsIO.ts`), `views/clients/clientsIO.ts` consumers (switch to partyIO), `router/index.ts`, `AppSidebar.vue` (Settings group entry).
**Exit:** `/contractors` full CRUD + import/export working against mocks; clients page regression-checked on the shared IO; delete guard blocks referenced contractors.

### Phase 9 — Settings → Lists CRUD

**Spec:** followup spec §2. **Files:** `views/settings/SettingsView.vue`, `components/settings/ConfigListEditor.vue` (new, one generic component — not four tables), `api/configLists.ts` (mutations), `mocks/configLists.ts` (`active` field), `composables/useConfigList.ts` (`includeInactive` option).
**Exit:** all four lists editable (add/rename/deactivate/delete-when-unused); stale-value rule verified — deactivating a used job code leaves saved documents rendering it and edit-mode shows "(inactive)"; usage counts correct against fixtures.

### Phase 10 — Export / Import wiring

**Spec:** followup spec §3. **Files:** `utils/importPipeline.ts` (new, generalized from ImportPreviewModal + partyIO), the six document list views (export handler only), Tax Rates view (import), Settings lists (import/export), Expenses view (export; import per policy).
**Exit:** document exports produce one-row-per-line-item CSVs respecting active filters; imports work on clients/contractors/tax-rates/config-lists with preview + per-row status; document lists still have **no** import button; §3.3 edge cases pass.

### Phase 11 — Attachments on received documents (mock persistence)

**Spec:** followup spec §4. **Files:** `types/common.ts` (Attachment), `components/documents/AttachmentsCard.vue` (new), the three detail + form views (received mode only), mocks.
**Exit:** upload/download/delete flows work on received docs with type/size/count validation; issued documents never render the card; "not persisted until backend" note visible.

### Backend track (no phase number — starts when backend work begins)

Document generation: followup spec §5 (template surgery, DocxRenderer, HTML→RichText incl. MP extended lists, formatting). Attachment persistence: followup spec §4 backend contract. Config-lists + all document APIs: main spec §11. These are **not** runnable by `/build-phase`; they follow `Bookkeeping_Implementation_Plan.md` phasing when the FastAPI backend starts.

---

## Checkpoint log

The `build-phase` skill appends one line here when a phase completes. This is the ground truth for "where are we" — a phase not listed here is not done, whatever the code looks like.

<!-- - [x] Phase N — YYYY-MM-DD — summary -->

- [x] Phase 5 — 2026-07-17 — Purchase Orders module: `api/purchaseOrders.ts` hooks; PO List/Form/Detail views (replaced stub); router `po-new`/`po-edit`/`po-detail`; proposal autofill (§4.4, incl. MP mapping) with dirty-check + `?from_proposal` mount autofill; issued-only Generate Doc + engagement Client-PO link (Owner-Invoice link deferred to Phase 6/7 as a disabled placeholder — Invoices module not built yet); cancel-with-linked-invoices warning + delete guard via ConfirmModal (no ToastService in app). Fixed pre-existing build break (`JobCode` re-export in `types/purchaseOrder.ts`). Build green.
- [x] Phase 6 — 2026-07-17 — Invoices module: `types/invoice.ts` (+ balance/due-date/overdue/status-suggestion helpers), `mocks/invoices.ts` (fixtures: overdue-unpaid, partially-paid, paid, received-w/-PO+engagement, received-owner-invoice-only), `api/invoices.ts` hooks (+ mark-paid), Invoice List/Form/Detail (replaced stub). PO autofill (§5.3) w/ dirty-check + `?from_po` mount autofill; payments/credits → status suggestion; computed Due Date + overdue chip (§13.4); Mark Paid quick action; mandatory engagement-link validation for received invoices (§5.2); issued-only Generate Doc. Owner-Invoice engagement link now live (both PO-form placeholder + invoice form). Build green.
- [x] Phase 11 — 2026-07-17 — Attachments on received documents (followup §4): `types/common.ts` `Attachment`; `mocks/attachments.ts` (object-URL store keyed by `module:recordId`, not persisted); `api/attachments.ts` (list/add/delete hooks + `downloadAttachment`); `components/documents/AttachmentsCard.vue` (upload/download/delete, type ≤ pdf/docx/xlsx/png/jpg, ≤10 MB, max 5, role-gated delete, "not persisted" note); wired into all three detail views, received-only (`v-if direction === 'received'`) so issued docs never render it. Form-mode attachment card deferred (new docs have no id yet). Build green.
- [x] Phase 10 — 2026-07-17 — Export/Import wiring (followup §3): `utils/documentExport.ts` — one-row-per-line-item flattener (header cols repeated + `Item Order` + item cols) per module; wired real Export into all six document lists (Proposals/POs/Invoices, both directions), respecting active filters across pages, filename `{module}-{direction}-{date}.csv`; removed the placeholder "not implemented" modals. Config-list CSV export added to `ConfigListEditor`. Document lists still have **no** Import button (§12 preserved). DEFERRED (noted): master-list *import* for Tax Rates (no mutable tax-rate store exists yet) and Config Lists (needs a label-keyed generalization of `ImportPreviewModal`), and Expenses export — clients/contractors imports already work (Phase 8). Build green.
- [x] Phase 9 — 2026-07-17 — Settings → Lists CRUD (followup §2): `mocks/configLists.ts` gains add/update/toggle/delete + `mockConfigListUsage` (scans full document fixtures for job-code/payment-term/reference/destination usage) + `includeInactive`; `api/configLists.ts` mutation + usage hooks; `useConfigList(name, { includeInactive })`; one generic `components/settings/ConfigListEditor.vue` (inline edit, add, deactivate/reactivate, usage-gated delete); `SettingsView.vue` renders all four lists (Job Codes, Payment Terms w/ delay_days, References, MP Destinations w/ address cols). Stale-value rule honored (saved docs keep labels; inactive still shown in editor). Build green.
- [x] Phase 8 — 2026-07-17 — Contractors settings page (followup §1): generalized `clientsIO.ts` → `utils/partyIO.ts` factory (`createPartyIO`), clients page now consumes the client-bound instance; contractor CRUD + import + document-reference delete guard in `mocks/contractors.ts`; mutation hooks in `api/contractors.ts`; `views/contractors/ContractorsListView.vue` + `ContractorFormModal.vue` (copy-adapted), reusing the shared `ImportPreviewModal`; `/contractors` route + Settings sidebar entry. Build green.
- [x] Phase 7 — 2026-07-17 — Cross-links & final sweep: linked-documents cards on Proposal detail (generated POs/invoices + engagement links) and completed PO detail (linked invoices) + Invoice detail (referencing contractor invoices, §5.4); enabled received-proposal engagement-link comboboxes (was Phase-3 placeholder); wired `mockPOLinkedInvoiceIds` → invoices store so PO delete-guard + cancel-cascade warning fire on real data; added `proposal_id`/engagement-link ids to `InvoiceListItem`; `?from_proposal`/`?from_po` mount autofill verified. Spec reconciled (new §14b build-status + deviations). Dev server boots clean (200); build green. Deviation touching `mocks/purchaseOrders.ts` (outside the Phase-7 file list) was required for the cross-module PO↔invoice wiring — noted here.

