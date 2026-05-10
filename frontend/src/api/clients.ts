import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import { mockSearchClientNames, mockClientLookup } from '../mocks/clients'
import { api as axios } from './axios'
import type { ClientContact } from '../types/proposal'

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
