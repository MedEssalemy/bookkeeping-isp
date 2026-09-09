import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import * as mocks from '../mocks/purchaseOrders'
import { api as axios } from './axios'
import type {
  PurchaseOrder,
  POListItem,
  POListParams,
  POPayload,
} from '../types/purchaseOrder'

interface ListResponse {
  items: POListItem[]
  total: number
  page: number
  page_size: number
}

async function listPOs(params: POListParams): Promise<ListResponse> {
  if (useMocks) return mocks.mockListPOs(params)
  return axios.get('/pos', { params }).then((r) => r.data as ListResponse)
}

async function getPO(id: string): Promise<PurchaseOrder | null> {
  if (useMocks) return mocks.mockGetPO(id)
  return axios.get(`/pos/${id}`).then((r) => r.data as PurchaseOrder)
}

async function nextPONumber(): Promise<string> {
  if (useMocks) return mocks.mockNextPONumber()
  return axios.get('/pos/next-number').then((r) => (r.data as { number: string }).number)
}

async function createPO(payload: POPayload): Promise<PurchaseOrder> {
  if (useMocks) return mocks.mockCreatePO(payload)
  return axios.post('/pos', payload).then((r) => r.data as PurchaseOrder)
}

async function updatePO(id: string, payload: POPayload): Promise<PurchaseOrder> {
  if (useMocks) return mocks.mockUpdatePO(id, payload)
  return axios.put(`/pos/${id}`, payload).then((r) => r.data as PurchaseOrder)
}

async function deletePO(id: string): Promise<void> {
  if (useMocks) return mocks.mockDeletePO(id)
  await axios.delete(`/pos/${id}`)
}

async function updatePOStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder> {
  if (useMocks) return mocks.mockUpdatePOStatus(id, status)
  return axios.patch(`/pos/${id}/status`, { status }).then((r) => r.data as PurchaseOrder)
}

async function poLinkedInvoiceIds(id: string): Promise<string[]> {
  if (useMocks) return mocks.mockPOLinkedInvoiceIds(id)
  return axios.get(`/pos/${id}/linked-invoices`).then((r) => r.data as string[])
}

async function generateDocument(id: string): Promise<Blob> {
  if (useMocks) return mocks.mockGenerateDocument(id)
  return axios.get(`/pos/${id}/document`, { responseType: 'blob' }).then((r) => r.data as Blob)
}

// ── TanStack Query hooks ──────────────────────────────────────────────────────

export function usePOList(params: Ref<POListParams>) {
  return useQuery({
    queryKey: ['pos', params],
    queryFn: () => listPOs(params.value),
  })
}

export function usePO(id: Ref<string>) {
  return useQuery({
    queryKey: ['po', id],
    queryFn: () => getPO(id.value),
    enabled: () => !!id.value,
  })
}

export function useNextPONumber() {
  return useQuery({
    queryKey: ['pos-next-number'],
    queryFn: () => nextPONumber(),
    staleTime: 0,
  })
}

export function usePOLinkedInvoiceIds(id: Ref<string>) {
  return useQuery({
    queryKey: ['po-linked-invoices', id],
    queryFn: () => poLinkedInvoiceIds(id.value),
    enabled: () => !!id.value,
  })
}

export function useCreatePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPO,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos'] }),
  })
}

export function useUpdatePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: POPayload }) => updatePO(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos'] }),
  })
}

export function useDeletePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePO,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pos'] }),
  })
}

export function useUpdatePOStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrder['status'] }) =>
      updatePOStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pos'] })
      qc.invalidateQueries({ queryKey: ['po', id] })
    },
  })
}

export function useGenerateDocument() {
  return useMutation({ mutationFn: generateDocument })
}
