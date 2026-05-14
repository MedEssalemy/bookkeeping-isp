import type { ClientContact } from '../types/proposal'
import { SEEDED_CLIENT_CONTACTS } from './clientsSeed'

/**
 * In-memory contacts store. Imports the seed and lets the app mutate it via
 * the UI (Add, Edit, Delete, Import). Reload resets to seed — persistence
 * comes when the backend lands.
 *
 * Each row gets a stable `_id`. We can't use array index because delete
 * shifts indices and would invalidate every consumer holding an id.
 */
interface StoredContact extends ClientContact { _id: string }

let nextId = 1
function genId(): string {
  return `c${nextId++}`
}

const contacts: StoredContact[] = SEEDED_CLIENT_CONTACTS.map((c) => ({
  ...c,
  _id: genId(),
}))

export function getAllContacts(): ClientContact[] {
  // Strip the internal _id when handing out raw rows (used by CSV export).
  return contacts.map(({ _id: _unused, ...rest }) => {
    void _unused
    return rest
  })
}

function delay<T>(data: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/**
 * Search by contact person name. The proposal form's "Contact" combobox uses
 * this. Returns *distinct* person names that match the query. Same person at
 * multiple facilities collapses into a single result.
 */
export function mockSearchClientNames(q: string): Promise<string[]> {
  const query = q.toLowerCase().trim()
  const names = Array.from(new Set(contacts.map((c) => c.name).filter(Boolean)))
  return delay(
    names.filter((n) => n.toLowerCase().includes(query)).sort(),
  )
}

/**
 * Return all contact rows for the given person name. The Contact picker on
 * the proposal form expects 1..N rows here — one per facility/address.
 */
export function mockClientLookup(name: string): Promise<ClientContact[]> {
  const key = name.trim().toLowerCase()
  return delay(contacts.filter((c) => c.name.trim().toLowerCase() === key))
}

/**
 * Full contacts list — used by both the Clients page (grouped by business in
 * the view itself) and the proposal Client Name picker. One row per
 * facility/address; the same person at two sites appears twice.
 */
export interface ContactRow extends ClientContact {
  id: string
}

function toRow(c: StoredContact): ContactRow {
  const { _id, ...rest } = c
  return { ...rest, id: _id }
}

export function mockListAllContacts(): Promise<ContactRow[]> {
  return delay(contacts.map(toRow))
}

/** UI-only stub for now — change to a POST when the backend is wired. */
export interface AddContactInput extends Omit<ClientContact, 'address_full'> {
  // address_full is optional — we compute it from parts if not provided.
  address_full?: string
}

const STATE_ABBR: Record<string, string> = {
  California: 'CA', Texas: 'TX', 'New York': 'NY', Nevada: 'NV',
}

function composeFullAddress(c: ClientContact): string {
  if (c.address_full) return c.address_full
  const state = c.state ? (STATE_ABBR[c.state.trim()] ?? c.state.trim()) : ''
  const cityZip = [c.city, [state, c.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  return [c.address, cityZip].filter(Boolean).join(', ')
}

function normalizeInput(input: AddContactInput): ClientContact {
  const trimmed: ClientContact = {
    name: input.name?.trim() ?? '',
    address: input.address?.trim() ?? '',
    title: input.title?.trim() || undefined,
    business_name: input.business_name?.trim() || undefined,
    department: input.department?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
    city: input.city?.trim() || undefined,
    county: input.county?.trim() || undefined,
    state: input.state?.trim() || undefined,
    zip: input.zip?.trim() || undefined,
    facility: input.facility?.trim() || undefined,
  }
  trimmed.address_full = composeFullAddress(trimmed)
  return trimmed
}

export function mockAddContact(input: AddContactInput): Promise<ContactRow> {
  const stored: StoredContact = { ...normalizeInput(input), _id: genId() }
  contacts.push(stored)
  return delay(toRow(stored))
}

export function mockUpdateContact(id: string, input: AddContactInput): Promise<ContactRow> {
  const idx = contacts.findIndex((c) => c._id === id)
  if (idx < 0) return Promise.reject(new Error(`Contact ${id} not found`))
  const updated: StoredContact = { ...normalizeInput(input), _id: id }
  contacts.splice(idx, 1, updated)
  return delay(toRow(updated))
}

export function mockDeleteContact(id: string): Promise<{ id: string }> {
  const idx = contacts.findIndex((c) => c._id === id)
  if (idx < 0) return Promise.reject(new Error(`Contact ${id} not found`))
  contacts.splice(idx, 1)
  return delay({ id })
}

// ── Import (merge by (name + business + facility)) ───────────────────────────

export interface ImportPlanItem {
  /** What we'll do with this row when the user confirms. */
  action: 'create' | 'update'
  /** Existing contact id if action === 'update'. */
  existingId?: string
  /** The new/updated row data. */
  row: AddContactInput
  /** Pre-existing row, present when action === 'update'. */
  existing?: ClientContact
}

export interface ImportPlan {
  items: ImportPlanItem[]
  newCount: number
  updateCount: number
  unchangedCount: number
}

function matchKey(c: { name?: string; business_name?: string; facility?: string }): string {
  return [c.name, c.business_name, c.facility]
    .map((v) => (v ?? '').trim().toLowerCase())
    .join('|')
}

function isShallowEqual(a: ClientContact, b: ClientContact): boolean {
  const keys: (keyof ClientContact)[] = [
    'name', 'address', 'title', 'business_name', 'department', 'phone',
    'email', 'city', 'county', 'state', 'zip', 'facility',
  ]
  return keys.every((k) => (a[k] ?? '') === (b[k] ?? ''))
}

/**
 * Build an import plan: classify each parsed row as create / update /
 * unchanged by matching on (name + business + facility). Doesn't mutate
 * the store — the user confirms before commit.
 */
export function planImport(rows: AddContactInput[]): ImportPlan {
  const byKey = new Map<string, StoredContact>()
  for (const c of contacts) byKey.set(matchKey(c), c)
  let newCount = 0
  let updateCount = 0
  let unchangedCount = 0
  const items: ImportPlanItem[] = []
  for (const r of rows) {
    const normalized = normalizeInput(r)
    const existing = byKey.get(matchKey(normalized))
    if (!existing) {
      newCount += 1
      items.push({ action: 'create', row: normalized })
      continue
    }
    if (isShallowEqual(existing, normalized)) {
      unchangedCount += 1
      continue
    }
    updateCount += 1
    items.push({
      action: 'update',
      existingId: existing._id,
      row: normalized,
      existing: { ...existing },
    })
  }
  return { items, newCount, updateCount, unchangedCount }
}

export function mockCommitImport(plan: ImportPlan): Promise<ImportPlan> {
  for (const item of plan.items) {
    if (item.action === 'create') {
      contacts.push({ ...(normalizeInput(item.row)), _id: genId() })
    } else if (item.action === 'update' && item.existingId) {
      const idx = contacts.findIndex((c) => c._id === item.existingId)
      if (idx >= 0) {
        contacts.splice(idx, 1, { ...normalizeInput(item.row), _id: item.existingId })
      }
    }
  }
  return delay(plan)
}
