import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import {
  mockSearchClientNames,
  mockClientLookup,
  mockListAllContacts,
  mockAddContact,
  mockUpdateContact,
  mockDeleteContact,
  mockCommitImport,
  planImport,
  type AddContactInput,
  type ContactRow,
  type ImportPlan,
} from '../mocks/clients'
import { api as axios } from './axios'
import type { ClientContact } from '../types/proposal'

export { planImport }
export type { ContactRow, AddContactInput, ImportPlan }

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

// ── Add contact ──────────────────────────────────────────────────────────────

async function addContact(input: AddContactInput): Promise<ContactRow> {
  if (useMocks) return mockAddContact(input)
  return axios.post('/clients/contacts', input).then((r) => r.data as ContactRow)
}

function invalidateClientQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['clients-all-contacts'] })
  qc.invalidateQueries({ queryKey: ['clients-businesses'] })
  qc.invalidateQueries({ queryKey: ['clients-business-contacts'] })
  qc.invalidateQueries({ queryKey: ['clients-names'] })
  qc.invalidateQueries({ queryKey: ['client-lookup'] })
}

/**
 * Add a new contact row. Invalidates all client-related queries on success so
 * every consumer (contact picker, clients list, business detail) re-fetches.
 */
export function useAddContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddContactInput) => addContact(input),
    onSuccess: () => invalidateClientQueries(qc),
  })
}

// ── Update / Delete / Import ────────────────────────────────────────────────

async function updateContact(args: { id: string; input: AddContactInput }): Promise<ContactRow> {
  if (useMocks) return mockUpdateContact(args.id, args.input)
  return axios.put(`/clients/contacts/${args.id}`, args.input).then((r) => r.data as ContactRow)
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; input: AddContactInput }) => updateContact(args),
    onSuccess: () => invalidateClientQueries(qc),
  })
}

async function deleteContact(id: string): Promise<{ id: string }> {
  if (useMocks) return mockDeleteContact(id)
  return axios.delete(`/clients/contacts/${id}`).then((r) => r.data as { id: string })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => invalidateClientQueries(qc),
  })
}

async function commitImport(plan: ImportPlan): Promise<ImportPlan> {
  if (useMocks) return mockCommitImport(plan)
  return axios.post('/clients/import', plan).then((r) => r.data as ImportPlan)
}

export function useCommitImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan: ImportPlan) => commitImport(plan),
    onSuccess: () => invalidateClientQueries(qc),
  })
}
