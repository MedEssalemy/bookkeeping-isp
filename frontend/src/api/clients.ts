import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import {
  mockSearchClientNames,
  mockClientLookup,
  mockListBusinesses,
  mockGetBusinessContacts,
  mockListAllContacts,
  type BusinessSummary,
  type ContactRow,
} from '../mocks/clients'
import { api as axios } from './axios'
import type { ClientContact } from '../types/proposal'

export type { BusinessSummary, ContactRow }

// ── Person name search (proposal Contact picker) ─────────────────────────────

async function searchClientNames(q: string): Promise<string[]> {
  if (useMocks) return mockSearchClientNames(q)
  return axios.get('/clients/names', { params: { q } }).then((r) => r.data as string[])
}

async function clientLookup(name: string): Promise<ClientContact[]> {
  if (useMocks) return mockClientLookup(name)
  return axios.get('/clients/lookup', { params: { name } }).then((r) => r.data as ClientContact[])
}

export function useClientNameSearch(q: Ref<string>) {
  return useQuery({
    queryKey: ['clients-names', q],
    queryFn: () => searchClientNames(q.value),
    enabled: () => q.value.trim().length >= 1,
  })
}

export function useClientLookup(name: Ref<string>) {
  return useQuery({
    queryKey: ['client-lookup', name],
    queryFn: () => clientLookup(name.value),
    enabled: () => !!name.value.trim(),
  })
}

// ── Clients list view (grouped by business) ──────────────────────────────────

async function listBusinesses(): Promise<BusinessSummary[]> {
  if (useMocks) return mockListBusinesses()
  return axios.get('/clients/businesses').then((r) => r.data as BusinessSummary[])
}

async function getBusinessContacts(business: string): Promise<ClientContact[]> {
  if (useMocks) return mockGetBusinessContacts(business)
  return axios
    .get('/clients/contacts', { params: { business } })
    .then((r) => r.data as ClientContact[])
}

export function useBusinesses() {
  return useQuery({
    queryKey: ['clients-businesses'],
    queryFn: () => listBusinesses(),
  })
}

export function useBusinessContacts(business: Ref<string>) {
  return useQuery({
    queryKey: ['clients-business-contacts', business],
    queryFn: () => getBusinessContacts(business.value),
    enabled: () => !!business.value.trim(),
  })
}

// ── Full contacts list (proposal Client Name picker) ─────────────────────────

async function listAllContacts(): Promise<ContactRow[]> {
  if (useMocks) return mockListAllContacts()
  return axios.get('/clients/contacts/all').then((r) => r.data as ContactRow[])
}

export function useAllContacts() {
  return useQuery({
    queryKey: ['clients-all-contacts'],
    queryFn: () => listAllContacts(),
  })
}
