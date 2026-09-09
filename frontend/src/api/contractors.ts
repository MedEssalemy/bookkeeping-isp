import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import {
  mockSearchContractorNames,
  mockContractorLookup,
  mockListAllContractors,
  mockAddContractor,
  mockUpdateContractor,
  mockDeleteContractor,
  mockCommitContractorImport,
  planContractorImport,
  type ContractorRow,
  type AddContractorInput,
} from '../mocks/contractors'
import type { ImportPlan } from '../mocks/clients'
import { api as axios } from './axios'
import type { Contractor } from '../types/common'

export { planContractorImport }
export type { ContractorRow, AddContractorInput }

// ── Person name search (contractor-side counterparty picker) ─────────────────

async function searchContractorNames(q: string): Promise<string[]> {
  if (useMocks) return mockSearchContractorNames(q)
  return axios.get('/contractors/names', { params: { q } }).then((r) => r.data as string[])
}

async function contractorLookup(name: string): Promise<Contractor[]> {
  if (useMocks) return mockContractorLookup(name)
  return axios.get('/contractors/lookup', { params: { name } }).then((r) => r.data as Contractor[])
}

export function useContractorNameSearch(q: Ref<string>) {
  return useQuery({
    queryKey: ['contractors-names', q],
    queryFn: () => searchContractorNames(q.value),
    enabled: () => q.value.trim().length >= 1,
  })
}

export function useContractorLookup(name: Ref<string>) {
  return useQuery({
    queryKey: ['contractor-lookup', name],
    queryFn: () => contractorLookup(name.value),
    enabled: () => !!name.value.trim(),
  })
}

// ── Full contractors list ────────────────────────────────────────────────────

async function listAllContractors(): Promise<ContractorRow[]> {
  if (useMocks) return mockListAllContractors()
  return axios.get('/contractors/all').then((r) => r.data as ContractorRow[])
}

export function useAllContractors() {
  return useQuery({
    queryKey: ['contractors-all'],
    queryFn: () => listAllContractors(),
  })
}

// ── Mutations (Contractors settings page, followup §1) ────────────────────────

function invalidateContractorQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['contractors-all'] })
  qc.invalidateQueries({ queryKey: ['contractors-names'] })
  qc.invalidateQueries({ queryKey: ['contractor-lookup'] })
}

async function addContractor(input: AddContractorInput): Promise<ContractorRow> {
  if (useMocks) return mockAddContractor(input)
  return axios.post('/contractors', input).then((r) => r.data as ContractorRow)
}

export function useAddContractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddContractorInput) => addContractor(input),
    onSuccess: () => invalidateContractorQueries(qc),
  })
}

async function updateContractor(args: { id: string; input: AddContractorInput }): Promise<ContractorRow> {
  if (useMocks) return mockUpdateContractor(args.id, args.input)
  return axios.put(`/contractors/${args.id}`, args.input).then((r) => r.data as ContractorRow)
}

export function useUpdateContractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; input: AddContractorInput }) => updateContractor(args),
    onSuccess: () => invalidateContractorQueries(qc),
  })
}

async function deleteContractor(id: string): Promise<{ id: string }> {
  if (useMocks) return mockDeleteContractor(id)
  return axios.delete(`/contractors/${id}`).then((r) => r.data as { id: string })
}

export function useDeleteContractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteContractor(id),
    onSuccess: () => invalidateContractorQueries(qc),
  })
}

async function commitContractorImport(plan: ImportPlan): Promise<ImportPlan> {
  if (useMocks) return mockCommitContractorImport(plan)
  return axios.post('/contractors/import', plan).then((r) => r.data as ImportPlan)
}

export function useCommitContractorImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan: ImportPlan) => commitContractorImport(plan),
    onSuccess: () => invalidateContractorQueries(qc),
  })
}
