import type { DocDirection } from './common'
import type { JobCode } from './proposal'

// Re-export so the Invoice module (mocks/views) has a single import surface for
// the job-code alias.
export type { JobCode }

// Status is a code-owned enum (spec §3.3), not an admin-configurable list.
// 'Draft' applies to issued invoices only; 'Overdue' is NOT a status — it's a
// computed flag (see isOverdue below).
export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Partially Paid' | 'Paid'

export const INVOICE_STATUSES: Record<DocDirection, InvoiceStatus[]> = {
  issued: ['Draft', 'Unpaid', 'Partially Paid', 'Paid'],
  received: ['Unpaid', 'Partially Paid', 'Paid'],
}

export function defaultInvoiceStatus(direction: DocDirection): InvoiceStatus {
  return direction === 'issued' ? 'Draft' : 'Unpaid'
}

export const INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, 'gray' | 'amber' | 'blue' | 'green'> = {
  Draft: 'gray',
  Unpaid: 'amber',
  'Partially Paid': 'blue',
  Paid: 'green',
}

/** Payment terms are an admin-configurable list (§3.4); the value is its label. */
export type PaymentTerms = string

// ── Line items ────────────────────────────────────────────────────────────────
// Same shape/formula as the Standard proposal/PO line item (reuses LineItemsTable).

export interface InvoiceLineItem {
  id: string
  job_code: JobCode | null
  description: string
  qty: number | null    // null = lump-sum (amount = rate); 0 = zero
  rate: number
  amount: number        // computed: qty == null ? rate : qty * rate
}

// ── Invoice ───────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string
  direction: DocDirection     // issued = clients side, received = contractors side
  number: string              // issued: INV-YY#### auto; received: contractor's external number
  status: InvoiceStatus
  date: string                // ISO

  po_id?: string              // linked PO in the same chain
  po_number?: string
  proposal_id?: string
  proposal_number?: string

  client_name: string         // counterparty (client or contractor)
  address?: string
  title?: string
  business_name?: string
  department?: string
  phone?: string
  email?: string
  project_no?: string
  agreement_no?: string
  ship_date?: string
  payment_terms?: PaymentTerms

  taxable: boolean
  tax_rate: number
  subtotal: number            // Σ amounts
  sales_tax: number           // tax_rate × subtotal
  total: number               // subtotal + sales_tax
  payments_credits: number    // default 0
  // computed, never stored on the form:
  //   balance_due = total - payments_credits
  //   due_date    = date + paymentTermsDelay(payment_terms)
  //   is_overdue  = status !== 'Paid' && today > due_date

  line_items: InvoiceLineItem[]
  notes?: string

  // Contractors side (received) — engagement link (§7). For received invoices
  // AT LEAST ONE of these two is REQUIRED (spec §5.2):
  linked_client_po_id?: string
  linked_owner_invoice_id?: string

  created_at: string
  updated_at: string
}

// ── List item (lightweight) ───────────────────────────────────────────────────

export interface InvoiceListItem {
  id: string
  number: string
  direction: DocDirection
  status: InvoiceStatus
  date: string
  client_name: string
  po_id?: string
  po_number?: string
  proposal_id?: string
  // Engagement links surfaced on the list item so cross-link cards can resolve
  // relationships without fetching every full invoice (§7).
  linked_client_po_id?: string
  linked_owner_invoice_id?: string
  total: number
  balance_due: number
  due_date: string
  is_overdue: boolean
  job_codes: JobCode[]
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface InvoiceListParams {
  direction: DocDirection   // required — every list call is direction-scoped
  q?: string
  status?: InvoiceStatus[]
  overdue?: boolean         // virtual "Overdue" filter (§5.1)
  from?: string
  to?: string
  client?: string
  job_code?: JobCode[]
  page?: number
  page_size?: number
}

// ── Form payload ──────────────────────────────────────────────────────────────

export interface InvoicePayload {
  number: string
  direction: DocDirection
  status: InvoiceStatus
  date: string

  po_id?: string
  po_number?: string
  proposal_id?: string
  proposal_number?: string

  client_name: string
  address?: string
  title?: string
  business_name?: string
  department?: string
  phone?: string
  email?: string
  project_no?: string
  agreement_no?: string
  ship_date?: string
  payment_terms?: PaymentTerms

  taxable: boolean
  tax_rate: number
  payments_credits: number

  line_items: Array<Omit<InvoiceLineItem, 'amount' | 'id'>>

  notes?: string
  linked_client_po_id?: string
  linked_owner_invoice_id?: string
}

// ── Computed-field helpers (spec §3.3, §13.4) ─────────────────────────────────

/** Balance still owed on an invoice. */
export function computeBalanceDue(total: number, paymentsCredits: number): number {
  return total - paymentsCredits
}

/** Due date = invoice date + payment-terms delay (days). */
export function computeDueDate(date: string, delayDays: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delayDays)
  return d.toISOString().slice(0, 10)
}

/** Overdue when not Paid and today is past the due date. */
export function computeIsOverdue(status: InvoiceStatus, dueDate: string, today = new Date().toISOString().slice(0, 10)): boolean {
  return status !== 'Paid' && !!dueDate && today > dueDate
}

/** Status suggestion from a payments/credits amount (§13.3) — advisory only. */
export function suggestStatus(paymentsCredits: number, total: number, direction: DocDirection): InvoiceStatus {
  if (paymentsCredits <= 0) return direction === 'issued' ? 'Unpaid' : 'Unpaid'
  if (paymentsCredits >= total) return 'Paid'
  return 'Partially Paid'
}
