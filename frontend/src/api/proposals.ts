import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import * as mocks from '../mocks/proposals'
import { api as axios } from './axios'
import type {
  Proposal,
  ProposalListItem,
  ProposalListParams,
  ProposalPayload,
  ProposalType,
} from '../types/proposal'

interface ListResponse {
  items: ProposalListItem[]
  total: number
  page: number
  page_size: number
}

async function listProposals(params: ProposalListParams): Promise<ListResponse> {
  if (useMocks) return mocks.mockListProposals(params)
  return axios.get('/proposals', { params }).then((r) => r.data as ListResponse)
}

async function getProposal(id: string): Promise<Proposal | null> {
  if (useMocks) return mocks.mockGetProposal(id)
  return axios.get(`/proposals/${id}`).then((r) => r.data as Proposal)
}

async function nextProposalNumber(type: ProposalType): Promise<string> {
  if (useMocks) return mocks.mockNextProposalNumber(type)
  return axios
    .get('/proposals/next-number', { params: { type: type === 'Standard' ? 'standard' : 'mp' } })
    .then((r) => (r.data as { number: string }).number)
}

async function createProposal(payload: ProposalPayload): Promise<Proposal> {
  if (useMocks) return mocks.mockCreateProposal(payload)
  return axios.post('/proposals', payload).then((r) => r.data as Proposal)
}

async function updateProposal(id: string, payload: ProposalPayload): Promise<Proposal> {
  if (useMocks) return mocks.mockUpdateProposal(id, payload)
  return axios.put(`/proposals/${id}`, payload).then((r) => r.data as Proposal)
}

async function deleteProposal(id: string): Promise<void> {
  if (useMocks) return mocks.mockDeleteProposal(id)
  await axios.delete(`/proposals/${id}`)
}

async function updateProposalStatus(id: string, status: Proposal['status']): Promise<Proposal> {
  if (useMocks) return mocks.mockUpdateProposalStatus(id, status)
  return axios.patch(`/proposals/${id}/status`, { status }).then((r) => r.data as Proposal)
}

async function generateDocument(id: string): Promise<Blob> {
  if (useMocks) return mocks.mockGenerateDocument(id)
  return axios.get(`/proposals/${id}/document`, { responseType: 'blob' }).then((r) => r.data as Blob)
}

async function previewDocument(id: string): Promise<null> {
  if (useMocks) return mocks.mockPreviewDocument(id)
  return axios.get(`/proposals/${id}/preview`).then(() => null)
}

// ── TanStack Query hooks ──────────────────────────────────────────────────────

export function useProposalList(params: Ref<ProposalListParams>) {
  return useQuery({
    queryKey: ['proposals', params],
    queryFn: () => listProposals(params.value),
  })
}

export function useProposal(id: Ref<string>) {
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: () => getProposal(id.value),
    enabled: () => !!id.value,
  })
}

export function useNextProposalNumber(type: Ref<ProposalType>) {
  return useQuery({
    queryKey: ['proposals-next-number', type],
    queryFn: () => nextProposalNumber(type.value),
    staleTime: 0,
  })
}

export function useCreateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProposal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })
}

export function useUpdateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProposalPayload }) =>
      updateProposal(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })
}

export function useDeleteProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })
}

export function useUpdateProposalStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Proposal['status'] }) =>
      updateProposalStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['proposals'] })
      qc.invalidateQueries({ queryKey: ['proposal', id] })
    },
  })
}

export function useGenerateDocument() {
  return useMutation({ mutationFn: generateDocument })
}

export function usePreviewDocument() {
  return useMutation({ mutationFn: previewDocument })
}
