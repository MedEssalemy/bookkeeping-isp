import type { ClientContact } from '../types/proposal'
import { SEEDED_CLIENT_CONTACTS } from './clientsSeed'

/**
 * In-memory contacts store. Imports the seed and lets the app mutate it via
 * the UI (Import CSV, future Add/Edit). Reload resets to seed — persistence
 * comes when the backend lands.
 */
const contacts: ClientContact[] = [...SEEDED_CLIENT_CONTACTS]

export function getAllContacts(): ClientContact[] {
  return contacts
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
 * List view: distinct businesses with counts. Used by ClientsListView.
 */
export interface BusinessSummary {
  business_name: string
  contact_count: number   // distinct person names
  facility_count: number  // distinct facilities
  row_count: number       // raw contact rows
}

export function mockListBusinesses(): Promise<BusinessSummary[]> {
  const byBiz = new Map<string, { people: Set<string>; facilities: Set<string>; rows: number }>()
  for (const c of contacts) {
    const biz = c.business_name?.trim() || '(Unspecified)'
    let agg = byBiz.get(biz)
    if (!agg) {
      agg = { people: new Set(), facilities: new Set(), rows: 0 }
      byBiz.set(biz, agg)
    }
    if (c.name) agg.people.add(c.name)
    if (c.facility) agg.facilities.add(c.facility)
    agg.rows += 1
  }
  const out: BusinessSummary[] = Array.from(byBiz.entries())
    .map(([business_name, agg]) => ({
      business_name,
      contact_count: agg.people.size,
      facility_count: agg.facilities.size,
      row_count: agg.rows,
    }))
    .sort((a, b) => a.business_name.localeCompare(b.business_name))
  return delay(out)
}

/**
 * Detail view: all contact rows for a specific business.
 */
export function mockGetBusinessContacts(business: string): Promise<ClientContact[]> {
  const key = business.trim().toLowerCase()
  return delay(
    contacts.filter((c) => (c.business_name?.trim().toLowerCase() ?? '') === key),
  )
}

/**
 * Full contacts list — used by the unified Client Name picker on the
 * proposal form. One row per facility/address, so the same person at two
 * sites appears twice. `id` is a stable identifier within the seed (currently
 * the array index, but exposed as `id` so callers don't depend on that).
 */
export interface ContactRow extends ClientContact {
  id: string
}

export function mockListAllContacts(): Promise<ContactRow[]> {
  return delay(contacts.map((c, i) => ({ ...c, id: String(i) })))
}
