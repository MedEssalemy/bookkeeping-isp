# Prompt — Proposal feature additions (Job Code surfacing + Import/Export shell)

Paste the section below into Claude Code in `bookkeeping-isp` after the proposal feature has been built and merged.

---

## Task

Add two enhancements to the existing **Proposal feature**:

1. **Job Code surfacing** — a `Job Codes` column in the list view showing the distinct codes used in each proposal's line items, a **column-header filter** (dropdown attached to the column header, not the filter row), and a working `Job Code` filter in the filter row — all filters interactive.
2. **Import / Export shell** — the buttons (Export and Import) are added to the UI, visually complete, but **fire no action**. Both are stubs — a `// TODO: implement` placeholder in the handler. They will be wired up in a separate task.

**Scope: `frontend/` only.**

## Reference docs

- **`docs/proposal_feature_spec.md`** — read it for context on the list view structure, column shapes, and filter patterns. Update it as part of Phase 0.
- `Bookkeeping_Implementation_Plan.md` §6 — general module conventions.

---

## Job Code library (use these exactly in all fixtures and dropdowns)

```
Decommissioning
Medical Physics Services
Service
Rental
Sales
Equipment Move
Parts
Shipping
System
Transportation
Discount
Service Charge
TAX Voucher Payment
Insurance
TAX Payment
Relocate
Sales and Use Tax
Travel
Property Tax
Tax
```

These are the only valid values for the `JobCode` field. Use them verbatim — same casing — everywhere: type union, mock fixtures, dropdown options, column-header filter, filter-row filter. **Do not add "Medical Physics Services" as an extra value — it's already in the list.**

---

## Build phases — stop after each phase, summarize, wait for go-ahead

### Phase 0 — Update the spec

Before touching code, extend `docs/proposal_feature_spec.md`:

- **§5.1 Page header** — add Export (↓) and Import (↑) buttons, secondary variant, Admin/Editor only, right side. Mark both as "shell only — no action in v1."
- **§5.1 Filter row** — add `Job Code` multi-select filter. OR semantics: a proposal matches if ≥1 of its line items' codes is in the selected set.
- **§5.2 Columns** — insert `Job Codes` column between `Project Name` and `Status`. Renders as a row of `StatusBadge` chips (gray variant). Max 3 visible; remainder shown as `+N more` with a tooltip listing all of them. Column header is interactive — clicking it opens a small filter dropdown attached to the header (same options as the filter-row `Job Code` filter, same state).
- **§3 API endpoints** — add `job_code` (multi) to the `GET /proposals` query params.
- **§9 Edge cases** — append: Job Code filter with multi-select OR semantics; column-header filter and filter-row filter share state (changing one updates the other).

Stop. Show me the spec diff before writing any TypeScript.

---

### Phase 1 — Types, mocks, API

- [ ] `src/types/proposal.ts` — add a `JobCode` type (string union of the 20 values above). Add `job_codes: JobCode[]` to `ProposalListItem`. Add `job_code?: JobCode[]` to `ProposalListParams`.

- [ ] `src/mocks/jobCodes.ts` — export the 20 values as a `JOB_CODES` const array. This is the single source of truth. The dropdown options in the filter row and the column-header filter both derive from this array; never hardcode the list in two places.

- [ ] `src/mocks/proposals.ts` — update fixtures to include realistic `job_codes` on each proposal:
  - Include proposals that use **multiple job codes** (proves truncation + tooltip behavior).
  - Include proposals that use **zero line items** (edge case — `job_codes: []`, column renders empty).
  - Spread the 20 codes across fixtures so every code appears at least once — makes filter testing meaningful.
  - MP proposals always include `"Medical Physics Services"` as one of their codes.

  The filter logic in the mock must be OR-semantics: `proposals.filter(p => p.job_codes.some(c => selectedCodes.includes(c)))`.

- [ ] `src/api/proposals.ts` — add `job_code?: JobCode[]` to `ProposalListParams`. Pass it through to the mock filter.

Stop. Confirm: the mock `useProposalList({ job_code: ['Service', 'Rental'] })` returns only proposals that have at least one of those codes. Log the result in a temp scratch call if needed.

---

### Phase 2 — List view changes

All changes are in `views/proposals/ProposalsListView.vue` (and sub-components where needed). Don't touch the form, detail view, or any other view.

#### 2a — Job Codes column

- Insert the `Job Codes` column between `Project Name` and `Status`.
- Each cell renders a horizontal flex row of `StatusBadge` chips (gray variant).
- **Max 3 chips visible.** If there are more, show a `+N more` chip (gray, same size) that on hover reveals a tooltip listing the remaining codes, one per line.
- Empty (no line items): render a `—` em-dash, same muted color as other empty cells in the table.
- MP proposals always include `Medical Physics Services` as a chip — no abbreviation needed in this column (it's one badge among potentially others).

#### 2b — Column-header filter

The column header for `Job Codes` is interactive. On click it opens a small dropdown panel attached to the header (not a modal, not the filter row — it's inline with the column header). The panel contains:

- A "Job Code" label at the top.
- A multi-select checklist of all 20 job codes.
- A "Clear" link (hidden when nothing selected).
- Clicking outside closes it.

**This filter shares state with the filter-row `Job Code` filter** — they are the same `ref`. Selecting codes in the column header ticks them in the filter row and vice versa. The column header shows a filled-filter icon (or a count badge) when active.

Use PrimeVue `OverlayPanel` (or `Popover` depending on your PrimeVue version) — don't build a custom dropdown from scratch.

#### 2c — Filter row additions

- Add `Job Code` multi-select to the filter row. Source: `JOB_CODES` from `src/mocks/jobCodes.ts`.
- **Make all existing filters interactive** — wire them to actually filter the displayed list. If filters are currently UI-only (not calling through to the mock's filter logic), fix that now. Specifically:
  - Status (multi-select) — matches `proposal.status`.
  - Type — matches `proposal.type`.
  - Date range — matches `proposal.date` between `from` and `to` (inclusive).
  - Client / Project — text search on `client_name` (Standard) or `project_location` (MP).
  - Search — matches `proposal.number` or `proposal.project_name` (case-insensitive substring).
  - Job Code — OR semantics as above.
- All filters compose (AND between different filter types).
- A "Clear all filters" link appears in the filter row when any filter is active.
- Filter state is local to the component (no router query params in this pass — that's a follow-up UX improvement).

#### 2d — Import / Export buttons (shell only)

Add two buttons to the page header, right side, between the filter row's right edge and "+ New Proposal":

| Button | Icon | Label | Variant | Role | On click |
|---|---|---|---|---|---|
| Export | `↓` (download icon) | Export | secondary / ghost | Admin + Editor | `// TODO: implement export` — no action, no toast |
| Import | `↑` (upload icon) | Import | secondary / ghost | Admin only | `// TODO: implement import` — no action, no toast |

Both buttons are **visually complete and role-gated** but fire nothing. Don't add a tooltip like "coming soon" — just the button. The intent is that the next task wires the handlers without touching the button layout.

Stop. Confirm: all six filters work and compose correctly; Job Code filter in the filter row and column-header panel share state; Export and Import buttons appear for the right roles but do nothing on click; `pnpm build` passes.

---

### Phase 3 — Sanity test

- [ ] Exercise every filter combination: single-filter, multi-filter, clear all.
- [ ] Confirm OR semantics for Job Code: select `Service` and `Rental` — proposals with either code appear.
- [ ] Confirm the column header filter icon shows a count badge when active.
- [ ] Confirm `+N more` tooltip lists remaining codes correctly.
- [ ] Confirm Export button appears for Editor role, Import button does not.
- [ ] Confirm both buttons do nothing on click (no console errors, no toasts).
- [ ] `pnpm build` succeeds, no console errors in `pnpm dev`.
- [ ] `docs/proposal_feature_spec.md` reflects all additions from Phase 0.

---

## Constraints

- **No backend changes.**
- **No new dependencies.** PrimeVue's `OverlayPanel`/`Popover` handles the column-header dropdown. SheetJS is **not** installed in this task — Export/Import are shells only.
- **Filter state is local `ref`s in the list view component.** No Pinia store, no router query params in this pass.
- **Don't touch the form, detail view, or any file outside `views/proposals` and `src/{types,mocks,api}`.**
- **No placeholder tooltips or disabled states on Export/Import.** The buttons are simply present and fire nothing — the next task wires them.
- **Job codes are a fixed list.** Don't pull them from an API endpoint in this pass. `JOB_CODES` in `src/mocks/jobCodes.ts` is the source. When the backend ships, the API hook will replace it; for now the array is the source of truth for both dropdown options and fixture data.

## Phase-end protocol

After each phase: post a short summary — what changed, what files touched, anything you had to interpret. Wait for explicit "go." If a spec ambiguity surfaces that Phase 0 didn't resolve, raise it before proceeding.

## Acceptance criteria

- Spec updated: §5.1 (header buttons, Job Code filter row), §5.2 (Job Codes column with column-header filter), §3 (filter params), §9 (edge cases).
- Job Codes column renders chips, truncates at 3, tooltips remainder.
- Column-header filter and filter-row filter share state.
- All list-view filters (Status, Type, Date range, Client/Project, Search, Job Code) are interactive and compose.
- Export and Import buttons are present, role-gated, and fire nothing.
- No new dependencies.
- `pnpm build` clean.
