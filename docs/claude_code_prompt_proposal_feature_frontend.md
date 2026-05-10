# Prompt — Proposal feature (frontend only)

Paste the section below into Claude Code in `bookkeeping-isp` after the restructure prompt has been completed and merged.

---

## Task

Implement the **Proposal feature** on the frontend per `docs/proposal_feature_spec.md`. Build all three surfaces — list view, entry form (create + edit), view page — plus the supporting API hooks, types, and composables.

**Scope: `frontend/` only.** Backend doesn't exist yet for this module. You'll mock the API responses (see §3 below) so the UI is fully exercisable in isolation.

## Reference docs

- **`docs/proposal_feature_spec.md`** — authoritative. Every field, every lookup behavior, every formula, every edge case is defined there. Don't redesign what's already specified; if something seems wrong, stop and ask before deviating.
- `Bookkeeping_Implementation_Plan.md` — for stack conventions (TanStack Query, Pinia, design tokens).

## Mocking strategy (no backend yet)

Add `src/mocks/` containing fixture data plus one mock dispatcher. API hooks consume it conditionally via a Vite env flag.

```
src/mocks/
├── index.ts          # exports a `useMocks` boolean from import.meta.env.VITE_USE_MOCKS
├── proposals.ts      # fixture array + mock fns (list, get, create, update, delete, etc.)
├── clients.ts        # fixture clients incl. multi-address cases
├── mpDestinations.ts # fixture destinations
└── taxRates.ts       # fixture tax rates by city
```

In each `src/api/<module>.ts`:

```ts
import { useMocks } from '@/mocks'
import * as mocks from '@/mocks/proposals'

export function listProposals(params: ProposalListParams) {
  if (useMocks) return mocks.listProposals(params)
  return axios.get('/proposals', { params }).then(r => r.data)
}
```

One conditional per function. When the backend ships, the conditionals get deleted in one mechanical pass. Don't introduce MSW, faker, or any new mocking library — fixture arrays + small async wrappers (`new Promise(resolve => setTimeout(() => resolve(data), 200))` for realistic latency) are sufficient.

Set `VITE_USE_MOCKS=true` in `.env.development`. Document this in a one-paragraph note appended to `frontend/README.md`.

**Fixture data requirements** — these specific shapes are needed to exercise the spec's edge cases:

- At least one client with **multiple addresses** under the same name (proves the §4.7.1 multi-address branch).
- At least one client with a **single address** (proves the auto-fill branch).
- At least 3 MP destinations.
- Tax rates for the cities used in the client and destination fixtures, plus one client whose city has no tax-rate row (proves the "default to 0" branch).
- A handful of saved proposals: 2 Standard, 2 MP, mixed statuses (Draft, Sent, Accepted, Declined), so the list view has something to render and filter.

## Build phases — stop after each phase, summarize what shipped, wait for go-ahead

The spec is large enough that one-shot delivery will lose detail. Work in vertical slices, smallest first.

### Phase 1 — Types, API hooks, mocks

- [ ] `src/types/proposal.ts` with all interfaces from the spec (Proposal, LineItem, ProposalStatus, ProposalType, ListParams, etc.).
- [ ] `src/api/proposals.ts` with TanStack Query hooks: `useProposalList`, `useProposal`, `useCreateProposal`, `useUpdateProposal`, `useDeleteProposal`, `useUpdateProposalStatus`, `useGenerateDocument`, `usePreviewDocument`, `useNextProposalNumber`.
- [ ] `src/api/clients.ts` — extend with `useClientLookup(name)`.
- [ ] `src/api/taxRates.ts` — `useTaxRateLookup(city, state)`.
- [ ] `src/api/mpDestinations.ts` — `useMPDestinations()`.
- [ ] All four `src/mocks/` files with the fixture shapes described above.

Stop. Confirm types compile, mocks load, hooks return data when called from a temporary scratch component.

### Phase 2 — List view

- [ ] `views/proposals/ProposalsListView.vue` per spec §5: filters, columns, row actions, status quick-edit popover.
- [ ] `views/proposals/components/StatusPopover.vue` (reusable, used here and in detail view).
- [ ] Wire to existing router route. Add "Proposals" to `AppSidebar` (already there if pre-existing — confirm role-gating works).
- [ ] Empty state, loading skeleton, error state.

Stop. Confirm the list renders fixture data, filters work, status popover updates the row, delete shows a `ConfirmModal`.

### Phase 3 — Entry form (the substantive phase)

- [ ] `composables/useProposalForm.ts` — encapsulates form state, the lookup logic (§4.7), the computed-field reactivity (§4.6), the manual-override flag for tax rate, and validation (§4.8). This composable is the brain — keep view components thin.
- [ ] `views/proposals/ProposalFormView.vue` — header section, both type-conditional field sets, line items, tax & totals, notes, services-provided. Routes: `/proposals/new` and `/proposals/:id/edit`.
- [ ] `views/proposals/components/LineItemsTable.vue` — handles both Standard and MP variants via a `variant` prop. Computed columns are read-only. Tab-cycling and Enter-to-add-row.
- [ ] `views/proposals/components/TotalsCards.vue` — renders Subtotal/SalesTax/Total for Standard, just Total for MP.
- [ ] Save flow per §4.9 including the 409 → "replace existing?" modal and the Accepted-status PO prompt.
- [ ] Cancel-with-dirty-form confirm per §4.10.
- [ ] Generate Document button: triggers `useGenerateDocument`. While mocks are on, show a toast "Document generation requires the backend" and download a placeholder `.txt` so the click is observable.

Stop. Confirm: a Standard proposal can be created end-to-end with multi-address client lookup, computed fields update synchronously, validation blocks save when fields are missing, the duplicate-number flow works. Then repeat with MP.

### Phase 4 — View page + doc preview

- [ ] `views/proposals/ProposalDetailView.vue` — same layout as form, all inputs disabled, Notes/Services rendered as HTML. Header actions per spec §6.
- [ ] `views/proposals/components/DocPreviewModal.vue` — renders the doc preview. While mocks are on, show "Preview will be available once the backend is implemented" placeholder content; wire the modal shell so the integration is mechanical when the backend lands.
- [ ] Add **mammoth** (`pnpm add mammoth`) — this is the one new dependency permitted by this task, for the future client-side preview path. Don't import it yet beyond a stub; it's there so the swap-in is one-line later.

Stop. Confirm: clicking a row in the list goes to the detail view, all data displays correctly, status popover works, Edit button navigates to the form pre-filled.

### Phase 5 — Polish & sanity test

- [ ] Run through every checkbox in spec §10 — mark each one done or note explicitly why it's deferred.
- [ ] Manually exercise every test in spec §9 (the edge-case list). Capture the results in a brief comment in the PR description.
- [ ] `pnpm build` succeeds. `pnpm dev` shows no console errors on any of the three routes.

## Constraints

- **No backend changes.** This task is frontend-only. Don't open files outside `frontend/`.
- **One new dependency allowed:** `mammoth` (for the future doc preview, stub-installed only).
- **No reorganization beyond what the spec requires.** Don't rename files, don't restructure folders, don't "improve" code outside the proposal feature's footprint.
- **No PO feature work.** The Accepted-status prompt navigates to `/purchase-orders/new?from_proposal=:id` — that route doesn't exist yet and that's fine. Confirm the navigation attempt fires; the destination 404 is expected.
- **No MP Destinations admin UI.** This task only consumes the destinations list; the CRUD surface is a separate feature.
- **Use base components from the restructure.** `BaseInput`, `BaseSelect`, `BaseDatePicker`, `RichTextEditor`, `StatusBadge`, `ConfirmModal`, `DataTable`, `ActionButtons`, `EmptyState`. Don't reinvent. If a base component is missing a feature you need, stop and ask whether to extend the base component or work around it.
- **`RichTextEditor` is locked at Tier 1.** If the form needs anything beyond bold/italic/underline/breaks/bullets, stop and ask. Don't bypass the editor's restrictions.
- **Don't anticipate features the spec doesn't mention.** No drag-and-drop reordering of line items. No autosave. No keyboard shortcuts beyond Tab/Enter in the line items table. No "duplicate proposal" action. The spec is the contract.

## Phase-end protocol

After each phase: post a short summary in the chat — what was built, what files changed, anything you had to interpret. Wait for explicit "go" before starting the next phase. If you finish a phase and see something that smells off in the spec, raise it before continuing rather than papering over it.

## Acceptance criteria (whole feature)

- All three routes render correctly with mock data.
- Every spec §9 edge case behaves as described.
- The §10 implementation checklist (frontend half) is fully checked off.
- `pnpm build` produces a clean production bundle.
- The diff is contained to `frontend/src/{views/proposals,components/proposals,api,mocks,composables,types}` plus the router and sidebar nav additions. No drive-by edits elsewhere.
