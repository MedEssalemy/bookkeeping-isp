import { MOCK_MP_DESTINATIONS } from './mpDestinations'
import { mockListPOs, mockGetPO } from './purchaseOrders'
import { mockListInvoices, mockGetInvoice } from './invoices'
import { mockListProposals, mockGetProposal } from './proposals'
import type { DocDirection } from '../types/common'

/**
 * Admin-configurable dropdown lists (spec §3.4). Every dropdown option in every
 * form comes from one of these lists via `useConfigList(name)` — components never
 * import an options array directly. This mock is the single source of truth for
 * the seed values; the real backend replaces it later with the same shapes.
 *
 * Row shape is a superset: every item has `{ id, label }`; specific lists carry
 * extra typed fields (Payment Terms → `delay_days`; MP Destinations → address
 * parts). Consumers that only need labels read `options`; consumers needing the
 * extras read `items` (see the composable).
 */
export interface ConfigListItem {
  id: string
  label: string
  active?: boolean // default true; deactivate hides from *new* selections (spec §3.4)
  // Payment Terms only
  delay_days?: number
  // MP Destinations only
  physical_address?: string
  city?: string
  state?: string
}

export type ConfigListName =
  | 'job_codes'
  | 'payment_terms'
  | 'references'
  | 'mp_destinations'

// ── Job Codes ─────────────────────────────────────────────────────────────────
// Canonical list (was the JOB_CODES const in mocks/jobCodes.ts, now re-exported
// from here so nothing holds a second copy — spec §3.4).
const JOB_CODE_LABELS = [
  'Decommissioning',
  'Medical Physics Services',
  'Service',
  'Rental',
  'Sales',
  'Equipment Move',
  'Parts',
  'Shipping',
  'System',
  'Transportation',
  'Discount',
  'Service Charge',
  'TAX Voucher Payment',
  'Insurance',
  'TAX Payment',
  'Relocate',
  'Sales and Use Tax',
  'Travel',
  'Property Tax',
  'Tax',
]

// ── Payment Terms ─────────────────────────────────────────────────────────────
// `delay_days` drives invoice due-date computation (spec §3.3).
const PAYMENT_TERMS: ConfigListItem[] = [
  { id: 'pt-0', label: 'Due On Receipt', delay_days: 0 },
  { id: 'pt-15', label: 'Net 15', delay_days: 15 },
  { id: 'pt-30', label: 'Net 30', delay_days: 30 },
  { id: 'pt-45', label: 'Net 45', delay_days: 45 },
  { id: 'pt-60', label: 'Net 60', delay_days: 60 },
]

// ── References (MP proposal form) ─────────────────────────────────────────────
// Seeded from the values previously hard-coded in the MP proposal form. The form
// itself is wired to useConfigList('references') in Phase 3.
const REFERENCES: ConfigListItem[] = [
  { id: 'ref-1', label: 'Proposal for Medical Physicist Professional Services' },
  { id: 'ref-2', label: 'Proposal for Medical Physicist' },
]

// ── MP Destinations ───────────────────────────────────────────────────────────
// Derived from the existing MP destinations mock so the data lives in one place.
// The Project Location field keeps sourcing from `useMPDestinations` (it needs
// the richer row for address autofill); this entry is here for completeness so
// the config store covers all four lists in spec §3.4.
const MP_DESTINATIONS: ConfigListItem[] = MOCK_MP_DESTINATIONS.map((d) => ({
  id: d.id,
  label: d.final_destination,
  physical_address: d.physical_address,
  city: d.city,
  state: d.state,
}))

const CONFIG_LISTS: Record<ConfigListName, ConfigListItem[]> = {
  job_codes: JOB_CODE_LABELS.map((label, i) => ({ id: `jc-${i + 1}`, label })),
  payment_terms: PAYMENT_TERMS,
  references: REFERENCES,
  mp_destinations: MP_DESTINATIONS,
}

function delay<T>(data: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/**
 * Return a config list. By default only active rows (the read path for form
 * dropdowns); `includeInactive` returns everything for the settings editor and
 * edit-mode dropdowns that must still render a saved stale value (spec §3.4).
 */
export function mockGetConfigList(name: ConfigListName, includeInactive = false): Promise<ConfigListItem[]> {
  const list = CONFIG_LISTS[name] ?? []
  return delay(includeInactive ? list.slice() : list.filter((i) => i.active !== false))
}

/** Raw job-code labels — the seed re-export point for mocks/jobCodes.ts. */
export const JOB_CODE_SEED: string[] = CONFIG_LISTS.job_codes.map((i) => i.label)

// ── Mutations (Settings → Lists CRUD, followup §2) ────────────────────────────

let nextListItemId = 1000
function genItemId(name: ConfigListName): string {
  return `${name}-new-${nextListItemId++}`
}

function normLabel(s: string): string {
  return s.trim().toLowerCase()
}

/** Extra (non-label) editable fields carried by some lists. */
export type ListItemExtras = Pick<ConfigListItem, 'delay_days' | 'physical_address' | 'city' | 'state'>

export function mockAddListItem(name: ConfigListName, label: string, extras: ListItemExtras = {}): Promise<ConfigListItem> {
  const list = CONFIG_LISTS[name]
  if (!list) return Promise.reject({ status: 404, message: 'Unknown list' })
  const clean = label.trim()
  if (!clean) return Promise.reject({ status: 422, message: 'Label is required' })
  if (list.some((i) => normLabel(i.label) === normLabel(clean))) {
    return Promise.reject({ status: 409, message: 'That value already exists' })
  }
  const item: ConfigListItem = { id: genItemId(name), label: clean, active: true, ...extras }
  list.push(item)
  return delay(item)
}

export function mockUpdateListItem(name: ConfigListName, id: string, patch: { label?: string } & ListItemExtras): Promise<ConfigListItem> {
  const list = CONFIG_LISTS[name]
  const item = list?.find((i) => i.id === id)
  if (!item) return Promise.reject({ status: 404, message: 'Item not found' })
  if (patch.label !== undefined) {
    const clean = patch.label.trim()
    if (!clean) return Promise.reject({ status: 422, message: 'Label is required' })
    if (list.some((i) => i.id !== id && normLabel(i.label) === normLabel(clean))) {
      return Promise.reject({ status: 409, message: 'That value already exists' })
    }
    item.label = clean
  }
  if (patch.delay_days !== undefined) item.delay_days = patch.delay_days
  if (patch.physical_address !== undefined) item.physical_address = patch.physical_address
  if (patch.city !== undefined) item.city = patch.city
  if (patch.state !== undefined) item.state = patch.state
  return delay({ ...item })
}

export function mockToggleListItem(name: ConfigListName, id: string, active: boolean): Promise<ConfigListItem> {
  const item = CONFIG_LISTS[name]?.find((i) => i.id === id)
  if (!item) return Promise.reject({ status: 404, message: 'Item not found' })
  item.active = active
  return delay({ ...item })
}

// ── Usage scan (delete-vs-deactivate + usage counts, §2.2) ────────────────────
// Counts how many saved documents reference each label of a list. Cheap in
// mocks (fixtures are small); the backend replaces this with a COUNT query.

const BOTH_DIRS: DocDirection[] = ['issued', 'received']

async function allFullDocs() {
  const [poLists, invLists, propLists] = await Promise.all([
    Promise.all(BOTH_DIRS.map((d) => mockListPOs({ direction: d, page: 1, page_size: 1000 }))),
    Promise.all(BOTH_DIRS.map((d) => mockListInvoices({ direction: d, page: 1, page_size: 1000 }))),
    Promise.all(BOTH_DIRS.map((d) => mockListProposals({ direction: d, page: 1, page_size: 1000 }))),
  ])
  const poIds = poLists.flatMap((r) => r.items.map((i) => i.id))
  const invIds = invLists.flatMap((r) => r.items.map((i) => i.id))
  const propIds = propLists.flatMap((r) => r.items.map((i) => i.id))
  const [pos, invoices, proposals] = await Promise.all([
    Promise.all(poIds.map((id) => mockGetPO(id))),
    Promise.all(invIds.map((id) => mockGetInvoice(id))),
    Promise.all(propIds.map((id) => mockGetProposal(id))),
  ])
  return {
    pos: pos.filter(Boolean),
    invoices: invoices.filter(Boolean),
    proposals: proposals.filter(Boolean),
  }
}

/** Usage counts keyed by label for every item in the given list. */
export async function mockConfigListUsage(name: ConfigListName): Promise<Record<string, number>> {
  const list = CONFIG_LISTS[name] ?? []
  const counts: Record<string, number> = {}
  for (const item of list) counts[item.label] = 0
  const { pos, invoices, proposals } = await allFullDocs()

  const bump = (label?: string | null) => {
    if (label && label in counts) counts[label] += 1
  }

  if (name === 'job_codes') {
    for (const d of [...pos, ...invoices]) for (const li of d!.line_items) bump(li.job_code)
    for (const p of proposals) for (const li of p!.line_items) bump((li as { job_code?: string }).job_code)
  } else if (name === 'payment_terms') {
    for (const d of [...pos, ...invoices]) bump(d!.payment_terms)
  } else if (name === 'references') {
    for (const p of proposals) bump(p!.reference)
  } else if (name === 'mp_destinations') {
    for (const p of proposals) bump(p!.project_location)
  }
  return counts
}

export async function mockDeleteListItem(name: ConfigListName, id: string): Promise<{ id: string }> {
  const list = CONFIG_LISTS[name]
  const item = list?.find((i) => i.id === id)
  if (!item) return Promise.reject({ status: 404, message: 'Item not found' })
  const usage = await mockConfigListUsage(name)
  if ((usage[item.label] ?? 0) > 0) {
    return Promise.reject({ status: 409, message: 'Item is in use', count: usage[item.label] })
  }
  const idx = list.findIndex((i) => i.id === id)
  list.splice(idx, 1)
  return delay({ id })
}
