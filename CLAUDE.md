# Bookkeeping App — Project Conventions

Vue 3 + TypeScript + Vite frontend for a two-sided bookkeeping tool (clients/income vs contractors/expenses). **Frontend only for now** — all data comes from `src/mocks/`; the FastAPI backend comes later. Do not scaffold backend code.

## Commands

```bash
pnpm --filter frontend dev      # dev server
pnpm --filter frontend build    # MUST pass before any phase is "done"
```

## Source of truth (read before coding, in this order)

1. `docs/two_sided_documents_spec.md` — current feature spec (sidebar, proposals/POs/invoices, direction model, config lists, import/export policy)
2. `docs/proposal_feature_spec.md` — proposal module patterns (forms, lookups, list behaviors) that all document modules copy
3. `docs/two_sided_execution_plan.md` — phased build plan; execute ONE phase at a time (use the `build-phase` skill)
4. `docs/erd.md` — future backend shape; mocks must stay compatible

If implementation must deviate from a spec, update the spec in the same change and say so in the report. Spec and code never disagree silently.

## Architecture rules (the leanness contract)

- **One component per document type, parametrized by `direction`** (`'issued' | 'received'`). Never fork a view per direction — six sidebar entries, three list components.
- **Copy the Proposals module pattern** for POs and Invoices (types → mocks → api hooks → list/form/detail). Do not invent a second pattern. Shared pieces live in `src/components/documents/` and are extracted only when the *second* consumer appears — no speculative abstraction.
- **Dropdown options come from `useConfigList(name)` only** (job codes, payment terms, references, MP destinations). Never import an options array into a component. Statuses, direction, and proposal Type are code-owned enums — not config lists.
- **Data layer:** TanStack Query hooks in `src/api/*`, fixtures in `src/mocks/*`. Components never touch mocks directly. Derived money fields (amount, subtotal, tax, total, balance, due date) are computed, never stored in form state.
- **Base components** (`src/components/base/`) are the only building blocks for inputs/tables/modals. Extend them; don't wrap PrimeVue ad hoc in views.
- **No new dependencies** without asking. No Pinia stores for feature state (auth store is the exception); filter state stays local `ref`s in list views.
- **Roles:** Admin/Editor mutate, Viewer read-only; Import is Admin-only. Every new action button gets role-gated.
- Received documents never show Generate/Preview Document. Document lists never show Import (export only) — see spec §12.

## Scope discipline

- Touch only the files a phase lists. If a fix outside that set is needed, stop and report instead of drive-by editing.
- Prefer editing an existing file over creating a new one. New file = justify it in the report.
- After every phase: `pnpm build` green, short report (changed files, decisions, deviations), then STOP and wait for go-ahead.
