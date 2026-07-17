# Follow-up Features — Spec

**Covers the "Later" list from `two_sided_execution_plan.md`:** Contractors settings page · Settings → Lists CRUD · Export/Import wiring · File attachments on received docs · Document generation (backend track).
**Prerequisite:** Phases 0–7 of the two-sided documents plan complete (checkpoint log is ground truth).
**Scope:** frontend, mock-driven — same rules as `two_sided_documents_spec.md` and `CLAUDE.md`. §5 is the exception: it's the backend track, written down so nothing is lost, not runnable now.

---

## 1. Contractors settings page

**Goal:** contractors get the same management surface clients have. (Contractors became a separate entity in `two_sided_documents_spec.md` §3.4; until now they only exist as mock fixtures feeding comboboxes.)

- Route `/contractors`, sidebar Settings group, between Clients and Configuration. Admin/Editor mutate, Viewer read-only (same as Clients).
- **Copy-adapt `views/clients/` wholesale:** `ContractorsListView.vue`, `ContractorFormModal.vue`, reuse `ImportPreviewModal`. Columns/fields identical to clients (`ClientContact` shape) — the legacy Outside Expenses tool literally reuses the client table structure. Rename labels only ("Contractor Name", etc.).
- **Generalize `clientsIO.ts` → `src/utils/partyIO.ts`** (parse/serialize keyed by a column map) so clients and contractors share one CSV round-trip implementation. Clients view switches to it in the same phase — that's the only permitted edit outside `views/contractors/`.
- Import/export enabled per the §12 policy of the main spec (master list = importable). Import admin-only.
- Delete guard: block deleting a contractor referenced by any document (mock check across proposal/PO/invoice fixtures); offer nothing fancier — the error toast names the count, same UX as client delete guard.

**Edge cases:** contractor with same name as a client (allowed — separate tables); import row colliding on (name, address) → "update" row status in preview, not duplicate.

---

## 2. Settings → Lists CRUD (config lists admin)

**Goal:** the admin UI behind `useConfigList` (main spec §3.4). Until now the lists are read-only seeds.

### 2.1 Surface

`/settings` (existing admin-only route) gains a **Lists** section: a tab or card strip with one editable table per list:

| List | Columns (editable) | Extra rules |
|---|---|---|
| Job Codes | label | — |
| Payment Terms | label, delay_days (int ≥ 0) | delay_days drives invoice due-date computation |
| References | label | MP proposals only |
| MP Destinations | final_destination, physical_address, city, state | city/state feed tax-rate lookup |

One generic component, `components/settings/ConfigListEditor.vue`, parametrized by a column schema — **not** four bespoke tables. MP Destinations is just the schema with more columns.

### 2.2 Behaviors

- **Add** — inline row or small modal (follow whichever pattern `ClientFormModal` set); label required, unique within the list (case-insensitive, trimmed — the legacy Setup sheet's dirty data (`Rental ` with trailing space, duplicate `Part. Paid`) is the cautionary tale).
- **Rename (edit)** — allowed anytime. Saved documents are untouched: they store the label as entered at save time (stale-value rule, main spec §3.4). The editor shows a one-line hint saying exactly that, so the admin isn't surprised.
- **Deactivate / reactivate** — toggle. Inactive values disappear from *new-selection* dropdowns; saved documents still render them; editing a saved doc shows the stale value as an "(inactive)" option.
- **Delete** — only when unused (mock usage scan across all document fixtures + expense fixtures). If used: the delete action is replaced by Deactivate, with the usage count shown ("Used in 14 documents").
- **Usage count column** — computed from the mock scan; cheap and it makes deactivate-vs-delete self-explanatory.
- No reordering in v1 (lists render alphabetically; Payment Terms by delay_days).

### 2.3 Data layer

Extend `api/configLists.ts` with mutation hooks (`useAddListItem`, `useUpdateListItem`, `useToggleListItem`, `useDeleteListItem`) writing to the mock store. Config-list rows get `{ id, label, active: boolean, ...extras }` — the `active` field is new; `useConfigList` (read path) filters to active by default with an `includeInactive` option for edit-mode dropdowns.

**Contract note for the backend later:** these map to `GET/POST/PATCH/DELETE /api/v1/config-lists/:list/items`; deactivation is `PATCH {active: false}`.

### 2.4 Edge cases

1. Deactivate a job code used on a saved invoice → invoice renders unchanged; editing it shows "(inactive)" option; new line items can't pick it.
2. Rename `Net 30` → `Net 30 days` → due-date computation still works (delay_days unchanged); saved invoices keep showing the old label.
3. Add duplicate label differing only by case/whitespace → validation error.
4. Delete blocked for in-use value; usage count matches a manual fixture count.
5. Payment term with delay_days = 0 (Due On Receipt) → due date = invoice date, overdue logic still correct.

---

## 3. Export / Import wiring

**Goal:** the shell buttons start working, per the policy in main spec §12 (export everywhere; import only master/config lists). Frontend-only: exports generate files client-side from mock data; imports mutate the mock store.

### 3.1 Export (all six document lists + expenses + settings tables)

- **Format:** CSV, UTF-8 BOM (Excel-friendly). No new dependencies — extend the `partyIO`/`clientsIO` serializer; PapaParse only if it's already installed (check first; if not, hand-rolled CSV with proper quoting is fine and already exists for clients).
- **Documents (proposals/POs/invoices):** flattened **one row per line item**, exactly the legacy archive-table shape (document header columns repeated per row + `Item Order` + item columns). This makes the export directly comparable with the legacy .xlsm archives during migration reconciliation — that's deliberate.
- **Respects active filters** — exports what the list currently shows (all pages, not just the visible page). A subtitle line in the export menu says "N documents (filtered)" vs "N documents".
- **Filename:** `{module}-{direction}-{YYYY-MM-DD}.csv` (e.g. `invoices-issued-2026-07-17.csv`); settings tables `{list}-{date}.csv`.
- Role: Admin + Editor.

### 3.2 Import (master/config lists only)

- Surfaces: Clients (already works), Contractors (§1), Tax Rates, and the four config lists (§2, from the Configuration page).
- **Pipeline (one shared implementation):** file pick → parse → schema validation → preview modal with per-row status (`new` / `update` / `error` + reason) → explicit confirm → apply to mock store → result toast with counts. Generalize the existing `ImportPreviewModal` + `clientsIO` into `utils/importPipeline.ts`; the per-surface code is only the column map + match key.
- **Never silent-drop:** error rows are listed in the preview and excluded from apply; the confirm button reads "Import N rows (M skipped)".
- Match keys: clients/contractors `(name, address)`; tax rates `(city, state)`; config lists `label` (case-insensitive).
- Role: Admin only. Document lists get **no import** — the buttons don't exist (already enforced in Phase 3; §3.1 here must not reintroduce them).

### 3.3 Edge cases

1. Export with filters active exports exactly the filtered set across pages.
2. Document with 3 line items exports as 3 rows sharing header values; re-sorting in Excel doesn't lose linkage (`Item Order` + document number on every row).
3. Import CSV with BOM, quoted commas, and CRLF parses correctly.
4. Import file with an unknown column → warning, column ignored, listed in preview.
5. Empty export (no rows after filters) → file with header row only, plus an info toast.

---

## 4. File attachments on received documents

**Goal:** received proposals/POs/invoices can carry the counterparty's original file (the PDF/docx they actually sent). Issued documents don't get attachments — their file is the generated one.

**Frontend v1 is mock-persistence:** files held as object URLs in the mock store (lost on refresh — an info note in the UI says attachments aren't persisted until the backend lands). This ships the full UX and the API contract without backend work.

- **Surface:** an **Attachments card** on the detail view and entry form of received documents only. Contents: file list (name, size, added date) + Upload button + per-file Download and Delete (Delete admin/editor, with ConfirmModal).
- **Constraints:** pdf, docx, xlsx, png/jpg; ≤ 10 MB; max 5 files per document. Validated client-side with clear error toasts.
- **Types:** `Attachment { id, file_name, size_bytes, mime_type, uploaded_at }`; documents gain `attachments?: Attachment[]` (received only — form hides the card when `direction === 'issued'`).
- **Backend contract (recorded now, built later):** `POST /:module/:id/attachments` (multipart), `GET /:module/:id/attachments`, `GET /attachments/:id/download`, `DELETE /attachments/:id`. Server re-validates type/size; files stored outside the DB (disk/Spaces), metadata in an `attachments` table with polymorphic `(module, record_id)` or per-module FKs — backend decision, not frontend's.

**Edge cases:** upload 6th file → blocked with toast; 11 MB file → blocked; delete attachment → gone from list without page reload; issued document never renders the card even by direct URL manipulation.

---

## 5. Document generation — backend track (NOT a frontend phase)

Recorded here so the knowledge from the template/VBA audit isn't lost. Execute when backend work starts (implementation plan Phases 2 & 6 govern the how; this section is the *what*).

### 5.1 Inputs already decided

- **Templates** live in `/templates`, placeholders are `{{PascalCase}}` — keep them; adapt docxtpl context keys to match (main spec §10 decision). Placeholder maps per template: main spec §10.1–10.4.
- **MP proposal:** generation fills only `{{Date}}`, `{{Total}}`, `{{ServicesProvided}}` + the items table. Header details are user-authored rich text inside Services Provided (decision 2026-07-16). The leftover `<<…>>` text-box placeholders are deleted manually from the .docx once — no code touches the text box.
- **Generation matrix:** issued documents only (main spec §9). Endpoints: main spec §11 (`POST /:module/:id/generate-document`, 422 for received).

### 5.2 Work items

1. One-time template surgery: add `{%tr for item in line_items %}` loop rows to all four templates (they're still static tables filled via Word bookmarks in the legacy VBA); convert `{{NotesTitle}}` to `{% if note %}Notes :{% endif %}`; delete the MP text-box leftovers.
2. `DocxRenderer` service: template path + context dict → streamed .docx (`Content-Disposition: attachment; filename="{number}.docx"`).
3. HTML→RichText helper for Tier-1 notes **plus** the MP Services Provided extended set (ordered lists, square bullets) — unit test per supported tag.
4. Currency/percent formatting server-side matching the legacy VBA formats (`$#,##0.00`; legacy used `$#,##0.000` for sales tax — normalize to 2 decimals, flag to the client).
5. Frontend change when this lands: replace the stub download with the real binary-fetch → blob → `<a download>` (already wired for it per main spec §9); enable Preview modal (mammoth.js Option B per proposal spec §7.2 — note: mammoth would be a new dependency, ask first).

### 5.3 Acceptance

Every issued document type generates, opens cleanly in Word and LibreOffice, and is visually compared against a legacy Excel-generated equivalent (implementation plan §8 exit criteria).

---

## 6. Open questions

1. Attachment storage backend (disk vs DO Spaces) — backend decision, blocks nothing frontend.
2. Should exports also offer .xlsx? CSV ships first; xlsx would need SheetJS (new dependency — ask before adding).
3. Sales-tax decimal places in generated docs (legacy prints 3) — confirm with client during §5 acceptance.

---

*End of spec.*
