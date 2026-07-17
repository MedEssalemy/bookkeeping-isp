import type { DocDirection } from './common'
import type { JobCode } from './proposal'

// Re-export so the PO module (mocks/views) has a single import surface for the
// job-code alias without reaching back into the proposal module.
export type { JobCode }

// Status is a code-owned enum (spec §3.2/§3.4), not an admin-configurable list.
export type POStatus = 'Open' | 'Approved' | 'Fulfilled' | 'Canceled'

/** Payment terms are an admin-configurable list (§3.4); the value is its label. */
export type PaymentTerms = string

export const PO_STATUSES: POStatus[] = ['Open', 'Approved', 'Fulfilled', 'Canceled']

export const PO_STATUS_VARIANTS: Record<POStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  Open: 'gray',
  Approved: 'blue',
  Fulfilled: 'green',
  Canceled: 'red',
}

// ── Line items ────────────────────────────────────────────────────────────────
// Same shape/formula as the Standard proposal line item (reuses LineItemsTable).

export interface POLineItem {
  id: string
  job_code: JobCode | null
  description: string
  qty: number | null    // null = lump-sum (amount = rate); 0 = zero
  rate: number
  amount: number        // computed: qty == null ? rate : qty * rate
}

// ── Purchase Order ────────────────────────────────────────────────────────────

export interface PurchaseOrder {
  id: string
  direction: DocDirection     // received = clients side, issued = contractors side
  number: string              // issued: PO-YY#### auto; received: client's external PO number
  status: POStatus
  date: string                // ISO

  proposal_id?: string        // linked proposal (optional)
  proposal_number?: string

  client_name: string         // counterparty (client or contractor)
  address?: string
  project_no?: string
  agreement_no?: string
  ship_date?: string
  ship_to?: string
  payment_terms?: PaymentTerms

  taxable: boolean
  tax_rate: number
  subtotal: number            // Σ amounts
  sales_tax: number           // tax_rate × subtotal
  total: number               // subtotal + sales_tax

  line_items: POLineItem[]
  notes?: string

  // Contractors side (issued) — engagement link (§7), both optional:
  linked_client_po_id?: string
  linked_owner_invoice_id?: string

  created_at: string
  updated_at: string
}

// ── List item (lightweight) ───────────────────────────────────────────────────

export interface POListItem {
  id: string
  number: string
  direction: DocDirection
  status: POStatus
  date: string
  client_name: string
  proposal_id?: string
  proposal_number?: string
  total: number
  job_codes: JobCode[]
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface POListParams {
  direction: DocDirection   // required — every list call is direction-scoped
  q?: string
  status?: POStatus[]
  from?: string
  to?: string
  client?: string
  job_code?: JobCode[]
  page?: number
  page_size?: number
}

// ── Form payload ──────────────────────────────────────────────────────────────

export interface POPayload {
  number: string
  direction: DocDirection
  status: POStatus
  date: string

  proposal_id?: string
  proposal_number?: string

  client_name: string
  address?: string
  project_no?: string
  agreement_no?: string
  ship_date?: string
  ship_to?: string
  payment_terms?: PaymentTerms

  taxable: boolean
  tax_rate: number

  line_items: Array<Omit<POLineItem, 'amount' | 'id'>>

  notes?: string
  linked_client_po_id?: string
  linked_owner_invoice_id?: string
}
