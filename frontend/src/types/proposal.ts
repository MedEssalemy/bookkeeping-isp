export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined'
export type ProposalType = 'Standard' | 'MP'

export type JobCode =
  | 'Decommissioning'
  | 'Medical Physics Services'
  | 'Service'
  | 'Rental'
  | 'Sales'
  | 'Equipment Move'
  | 'Parts'
  | 'Shipping'
  | 'System'
  | 'Transportation'
  | 'Discount'
  | 'Service Charge'
  | 'TAX Voucher Payment'
  | 'Insurance'
  | 'TAX Payment'
  | 'Relocate'
  | 'Sales and Use Tax'
  | 'Travel'
  | 'Property Tax'
  | 'Tax'

// ── Line items ────────────────────────────────────────────────────────────────

export interface StandardLineItem {
  id: string
  job_code: JobCode | null
  description: string
  qty: number | null      // nullable — empty = lump-sum
  rate: number
  // computed
  amount: number
}

export interface MPLineItem {
  id: string
  services: string
  hourly_rate: number | null  // nullable — empty = lump-sum (hours_estimated as fee)
  hours_estimated: number
  // computed
  estimated_fee: number
  // hidden, fixed:
  job_code: 'Medical Physics Services'
}

// ── Proposal (full detail) ────────────────────────────────────────────────────

export interface Proposal {
  id: string
  number: string
  type: ProposalType
  status: ProposalStatus
  date: string // ISO date

  // ── Standard fields ──
  client_name?: string
  address?: string
  title?: string
  business_name?: string
  department?: string
  phone?: string
  email?: string
  project_no?: string
  project_name?: string
  agreement_no?: string
  proposal_valid_till?: string // ISO date

  // ── MP fields ──
  reference?: string
  project_location?: string  // selected mp_destination final_destination
  project_type?: string

  // ── Tax & totals ──
  taxable: boolean
  tax_rate: number  // decimal e.g. 0.0825
  subtotal: number
  sales_tax: number
  total: number

  // ── Line items ──
  line_items: StandardLineItem[] | MPLineItem[]

  // ── Rich text ──
  notes?: string
  services_provided?: string  // MP only

  // ── Timestamps ──
  created_at: string
  updated_at: string
}

// ── List item (lightweight, for list view) ───────────────────────────────────

export interface ProposalListItem {
  id: string
  number: string
  type: ProposalType
  status: ProposalStatus
  date: string
  client_name?: string
  project_location?: string
  project_name?: string
  total: number
  job_codes: JobCode[]
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface ProposalListParams {
  q?: string
  status?: ProposalStatus[]
  type?: ProposalType
  from?: string
  to?: string
  client?: string
  job_code?: JobCode[]
  page?: number
  page_size?: number
}

// ── Form payload ──────────────────────────────────────────────────────────────

export interface ProposalPayload {
  number: string
  type: ProposalType
  status: ProposalStatus
  date: string

  // Standard
  client_name?: string
  address?: string
  title?: string
  business_name?: string
  department?: string
  phone?: string
  email?: string
  project_no?: string
  project_name?: string
  agreement_no?: string
  proposal_valid_till?: string

  // MP
  reference?: string
  project_location?: string
  project_type?: string

  // Tax
  taxable: boolean
  tax_rate: number

  // Line items (without computed fields and id)
  line_items: Array<
    | Omit<StandardLineItem, 'amount' | 'id'>
    | Omit<MPLineItem, 'estimated_fee' | 'id'>
  >

  notes?: string
  services_provided?: string
}

// ── Clients ───────────────────────────────────────────────────────────────────

/**
 * A row in the clients/contacts table.
 *
 * Semantically: `name` is the *person's* name (e.g. "Ali Gharaviram"), and
 * `business_name` is the organization (e.g. "Kaiser Permanente"). Originally
 * the model used `name` for the org; we kept the field name to avoid a wide
 * rename, but the meaning shifted when real data arrived.
 *
 * The same person may appear in multiple rows (one per facility/address).
 */
export interface ClientContact {
  /** The contact person's name (CSV column "Client Name"). */
  name: string
  /** The street address tied to this row. */
  address: string
  title?: string
  /** The parent organization (CSV column "Business Name"). */
  business_name?: string
  department?: string
  phone?: string
  email?: string
  city?: string
  county?: string
  state?: string
  /**
   * Specific site or sub-location within the business (e.g. for Kaiser
   * Permanente: "Elk Grove MOB" vs. "South Sacramento MC"). Used to
   * disambiguate contact rows in the picker UI.
   */
  facility?: string
}

// ── MP Destinations ───────────────────────────────────────────────────────────

export interface MPDestination {
  id: string
  final_destination: string
  physical_address: string
  city?: string
  state?: string
}

// ── Tax rates ─────────────────────────────────────────────────────────────────

export interface TaxRate {
  city: string
  state: string
  rate: number // decimal e.g. 0.0825
}
