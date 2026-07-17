import type { Contractor } from '../types/common'

/**
 * In-memory contractors (subcontractors) store — mirrors mocks/clients.ts but
 * only the read path the counterparty comboboxes need (name search, lookup,
 * list all). Contractor CRUD/import belongs to the future Contractors settings
 * page (out of scope here, spec §3.4), so it's intentionally omitted.
 *
 * Contractor shares the ClientContact shape: `name` is the person, and
 * `business_name` is their company; the same person may appear once per
 * facility/address.
 */
interface StoredContractor extends Contractor {
  _id: string
}

let nextId = 1
function genId(): string {
  return `sub${nextId++}`
}

const SEED: Contractor[] = [
  {
    name: 'Raj Patel',
    business_name: 'Precision Calibration Services',
    address: '4200 Westheimer Rd',
    address_full: '4200 Westheimer Rd, Houston, TX 77027',
    title: 'Field Engineer',
    phone: '(713) 555-0710',
    email: 'raj@precisioncal.example',
    city: 'Houston',
    state: 'TX',
    zip: '77027',
  },
  {
    name: 'Elena Ruiz',
    business_name: 'MedPhys Consulting LLC',
    address: '9 Research Pkwy',
    address_full: '9 Research Pkwy, Dallas, TX 75201',
    title: 'Consulting Physicist',
    phone: '(214) 555-0822',
    email: 'elena@medphysllc.example',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
  },
  {
    name: 'Tom Becker',
    business_name: 'Rigging & Transport Co',
    address: '188 Industrial Blvd',
    address_full: '188 Industrial Blvd, San Antonio, TX 78201',
    title: 'Operations Lead',
    phone: '(210) 555-0933',
    email: 'tom@rigtransport.example',
    city: 'San Antonio',
    state: 'TX',
    zip: '78201',
  },
]

const contractors: StoredContractor[] = SEED.map((c) => ({ ...c, _id: genId() }))

function delay<T>(data: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/** Distinct contractor person names matching the query (combobox search). */
export function mockSearchContractorNames(q: string): Promise<string[]> {
  const query = q.toLowerCase().trim()
  const names = Array.from(new Set(contractors.map((c) => c.name).filter(Boolean)))
  return delay(names.filter((n) => n.toLowerCase().includes(query)).sort())
}

/** All rows for a given person name (1..N — one per facility/address). */
export function mockContractorLookup(name: string): Promise<Contractor[]> {
  const key = name.trim().toLowerCase()
  return delay(contractors.filter((c) => c.name.trim().toLowerCase() === key))
}

export interface ContractorRow extends Contractor {
  id: string
}

function toRow(c: StoredContractor): ContractorRow {
  const { _id, ...rest } = c
  return { ...rest, id: _id }
}

/** Full contractor list — the counterparty picker on contractor-side forms. */
export function mockListAllContractors(): Promise<ContractorRow[]> {
  return delay(contractors.map(toRow))
}

// ── CRUD + import (Contractors settings page, followup spec §1) ────────────────
// Contractors share the ClientContact shape, so we reuse the clients' input and
// import-plan types verbatim rather than duplicating them.
import type { AddContactInput, ImportPlan } from './clients'
import { mockListPOs } from './purchaseOrders'
import { mockListInvoices } from './invoices'
import { mockListProposals } from './proposals'

export type AddContractorInput = AddContactInput

const STATE_ABBR: Record<string, string> = {
  California: 'CA', Texas: 'TX', 'New York': 'NY', Nevada: 'NV',
}
function composeFullAddress(c: Contractor): string {
  if (c.address_full) return c.address_full
  const state = c.state ? (STATE_ABBR[c.state.trim()] ?? c.state.trim()) : ''
  const cityZip = [c.city, [state, c.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [c.address, cityZip].filter(Boolean).join(', ')
}
function normalizeInput(input: AddContractorInput): Contractor {
  const trimmed: Contractor = {
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

export function mockAddContractor(input: AddContractorInput): Promise<ContractorRow> {
  const stored: StoredContractor = { ...normalizeInput(input), _id: genId() }
  contractors.push(stored)
  return delay(toRow(stored))
}

export function mockUpdateContractor(id: string, input: AddContractorInput): Promise<ContractorRow> {
  const idx = contractors.findIndex((c) => c._id === id)
  if (idx < 0) return Promise.reject(new Error(`Contractor ${id} not found`))
  const updated: StoredContractor = { ...normalizeInput(input), _id: id }
  contractors.splice(idx, 1, updated)
  return delay(toRow(updated))
}

/**
 * Count documents referencing a contractor by counterparty name. Contractors
 * are the counterparty on issued POs, received proposals, and received invoices
 * (spec §0.1). Used by the delete guard.
 */
export async function mockContractorReferenceCount(name: string): Promise<number> {
  const key = name.trim().toLowerCase()
  const [pos, invoices, proposals] = await Promise.all([
    mockListPOs({ direction: 'issued', page: 1, page_size: 1000 }),
    mockListInvoices({ direction: 'received', page: 1, page_size: 1000 }),
    mockListProposals({ direction: 'received', page: 1, page_size: 1000 }),
  ])
  const inPos = pos.items.filter((d) => (d.client_name ?? '').trim().toLowerCase() === key).length
  const inInv = invoices.items.filter((d) => (d.client_name ?? '').trim().toLowerCase() === key).length
  const inProp = proposals.items.filter((d) => (d.client_name ?? '').trim().toLowerCase() === key).length
  return inPos + inInv + inProp
}

export async function mockDeleteContractor(id: string): Promise<{ id: string }> {
  const idx = contractors.findIndex((c) => c._id === id)
  if (idx < 0) return Promise.reject(new Error(`Contractor ${id} not found`))
  const count = await mockContractorReferenceCount(contractors[idx].name)
  if (count > 0) return Promise.reject({ status: 409, message: 'Contractor is referenced by documents', count })
  contractors.splice(idx, 1)
  return delay({ id })
}

// ── Import (merge by name + business + facility) ───────────────────────────────

function matchKey(c: { name?: string; business_name?: string; facility?: string }): string {
  return [c.name, c.business_name, c.facility].map((v) => (v ?? '').trim().toLowerCase()).join('|')
}
function isShallowEqual(a: Contractor, b: Contractor): boolean {
  const keys: (keyof Contractor)[] = [
    'name', 'address', 'title', 'business_name', 'department', 'phone',
    'email', 'city', 'county', 'state', 'zip', 'facility',
  ]
  return keys.every((k) => (a[k] ?? '') === (b[k] ?? ''))
}

export function planContractorImport(rows: AddContractorInput[]): ImportPlan {
  const byKey = new Map<string, StoredContractor>()
  for (const c of contractors) byKey.set(matchKey(c), c)
  let newCount = 0
  let updateCount = 0
  let unchangedCount = 0
  const items: ImportPlan['items'] = []
  for (const r of rows) {
    const normalized = normalizeInput(r)
    const existing = byKey.get(matchKey(normalized))
    if (!existing) {
      newCount += 1
      items.push({ action: 'create', row: normalized })
      continue
    }
    if (isShallowEqual(existing, normalized)) { unchangedCount += 1; continue }
    updateCount += 1
    items.push({ action: 'update', existingId: existing._id, row: normalized, existing: { ...existing } })
  }
  return { items, newCount, updateCount, unchangedCount }
}

export function mockCommitContractorImport(plan: ImportPlan): Promise<ImportPlan> {
  for (const item of plan.items) {
    if (item.action === 'create') {
      contractors.push({ ...normalizeInput(item.row), _id: genId() })
    } else if (item.action === 'update' && item.existingId) {
      const idx = contractors.findIndex((c) => c._id === item.existingId)
      if (idx >= 0) contractors.splice(idx, 1, { ...normalizeInput(item.row), _id: item.existingId })
    }
  }
  return delay(plan)
}
