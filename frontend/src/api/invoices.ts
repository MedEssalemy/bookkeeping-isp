import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import * as mocks from '../mocks/invoices'
import { api as axios } from './axios'
import type {
  Invoice,
  InvoiceListItem,
  InvoiceListParams,
  InvoicePayload,
} from '../types/invoice'

interface ListResponse {
  items: InvoiceListItem[]
  total: number
  page: number
  page_size: number
}

async function listInvoices(params: InvoiceListParams): Promise<ListResponse> {
  if (useMocks) return mocks.mockListInvoices(params)
  return axios.get('/invoices', { params }).then((r) => r.data as ListResponse)
}

async function getInvoice(id: string): Promise<Invoice | null> {
  if (useMocks) return mocks.mockGetInvoice(id)
  return axios.get(`/invoices/${id}`).then((r) => r.data as Invoice)
}

async function nextInvoiceNumber(): Promise<string> {
  if (useMocks) return mocks.mockNextInvoiceNumber()
  return axios.get('/invoices/next-number').then((r) => (r.data as { number: string }).number)
}

async function createInvoice(payload: InvoicePayload): Promise<Invoice> {
  if (useMocks) return mocks.mockCreateInvoice(payload)
  return axios.post('/invoices', payload).then((r) => r.data as Invoice)
}

async function updateInvoice(id: string, payload: InvoicePayload): Promise<Invoice> {
  if (useMocks) return mocks.mockUpdateInvoice(id, payload)
  return axios.put(`/invoices/${id}`, payload).then((r) => r.data as Invoice)
}

async function deleteInvoice(id: string): Promise<void> {
  if (useMocks) return mocks.mockDeleteInvoice(id)
  await axios.delete(`/invoices/${id}`)
}

async function updateInvoiceStatus(id: string, status: Invoice['status']): Promise<Invoice> {
  if (useMocks) return mocks.mockUpdateInvoiceStatus(id, status)
  return axios.patch(`/invoices/${id}/status`, { status }).then((r) => r.data as Invoice)
}

async function markInvoicePaid(id: string): Promise<Invoice> {
  if (useMocks) return mocks.mockMarkInvoicePaid(id)
  return axios.patch(`/invoices/${id}/mark-paid`).then((r) => r.data as Invoice)
}

async function generateDocument(id: string): Promise<Blob> {
  if (useMocks) return mocks.mockGenerateDocument(id)
  return axios.get(`/invoices/${id}/document`, { responseType: 'blob' }).then((r) => r.data as Blob)
}

// ── TanStack Query hooks ──────────────────────────────────────────────────────

export function useInvoiceList(params: Ref<InvoiceListParams>) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => listInvoices(params.value),
  })
}

export function useInvoice(id: Ref<string>) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id.value),
    enabled: () => !!id.value,
  })
}

export function useNextInvoiceNumber() {
  return useQuery({
    queryKey: ['invoices-next-number'],
    queryFn: () => nextInvoiceNumber(),
    staleTime: 0,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InvoicePayload }) => updateInvoice(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice['status'] }) => updateInvoiceStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
    },
  })
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markInvoicePaid(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
    },
  })
}

export function useGenerateDocument() {
  return useMutation({ mutationFn: generateDocument })
}
