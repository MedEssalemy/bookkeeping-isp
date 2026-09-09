import {
  computeBalanceDue,
  computeDueDate,
  computeIsOverdue,
  type Invoice,
  type InvoiceLineItem,
  type InvoiceListItem,
  type InvoiceListParams,
  type InvoicePayload,
  type JobCode,
} from '../types/invoice'

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function mkId() {
  return Math.random().toString(36).slice(2)
}

// Payment-terms delay map (mirrors the configLists seed §3.4). The invoice list
// needs delay_days to compute due dates; kept minimal here so the mock is
// self-contained. The real backend joins the payment-terms table.
const TERM_DELAYS: Record<string, number> = {
  'Due On Receipt': 0,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60,
}
function termDelay(terms?: string): number {
  return terms ? (TERM_DELAYS[terms] ?? 0) : 0
}

// ── Line-item computation (same formula as PO/Standard proposals) ─────────────

function computeAmount(qty: number | null, rate: number): number {
  if (qty === null || qty === undefined) return rate
  return qty * rate
}

function calcItem(item: Omit<InvoiceLineItem, 'amount'>): InvoiceLineItem {
  return { ...item, amount: computeAmount(item.qty, item.rate) }
}

function recomputeTotals(inv: Invoice) {
  inv.subtotal = inv.line_items.reduce((s, i) => s + i.amount, 0)
  inv.sales_tax = inv.taxable ? inv.subtotal * inv.tax_rate : 0
  inv.total = inv.subtotal + inv.sales_tax
}

// ── Numbering (issued only; spec §8) ──────────────────────────────────────────

let nextIssuedNum = 31   // INV-260030 / INV-260031 exist → next is INV-260032

function generateNumber(yy = '26'): string {
  nextIssuedNum++
  return `INV-${yy}${String(nextIssuedNum).padStart(4, '0')}`
}
function previewNextNumber(yy = '26'): string {
  return `INV-${yy}${String(nextIssuedNum + 1).padStart(4, '0')}`
}

// ── Fixtures (spec §3.5) ──────────────────────────────────────────────────────

const INVOICE_SEED: Invoice[] = [
  // Issued invoice against the received client PO po1 (clients-side chain:
  // issued proposal → received PO → issued invoice). Overdue + unpaid.
  {
    id: 'inv1',
    direction: 'issued',
    number: 'INV-260030',
    status: 'Unpaid',
    date: '2026-06-01',
    po_id: 'po1',
    po_number: '4500123977',
    proposal_id: 'p3',
    proposal_number: 'Q-260003',
    client_name: 'Gamma Health Systems',
    address: '300 Elm Rd, San Antonio, TX',
    project_no: 'PRJ-GAMMA-01',
    agreement_no: 'AGR-2026-003',
    payment_terms: 'Net 30',
    taxable: true,
    tax_rate: 0.0825,
    payments_credits: 0,
    line_items: [
      calcItem({ id: 'il1', job_code: 'System', description: 'Full system overhaul', qty: 1, rate: 18000 }),
      calcItem({ id: 'il2', job_code: 'Decommissioning', description: 'Decommission old unit', qty: 1, rate: 2500 }),
      calcItem({ id: 'il3', job_code: 'Transportation', description: 'Transportation', qty: null, rate: 1200 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Net 30. Overdue if unpaid past due date.</p>',
    created_at: '2026-06-01T09:00:00Z',
    updated_at: '2026-06-01T09:00:00Z',
  },
  // Issued invoice, partially paid.
  {
    id: 'inv2',
    direction: 'issued',
    number: 'INV-260031',
    status: 'Partially Paid',
    date: '2026-06-20',
    po_id: 'po5',
    po_number: 'PO-ACME-501',
    client_name: 'Acme Medical Center',
    address: '100 Main St, Austin, TX',
    payment_terms: 'Net 45',
    taxable: true,
    tax_rate: 0.0825,
    payments_credits: 2000,
    line_items: [
      calcItem({ id: 'il4', job_code: 'Parts', description: 'Replacement coil', qty: 1, rate: 4500 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-06-20T09:00:00Z',
    updated_at: '2026-06-25T09:00:00Z',
  },
  // Issued invoice, paid in full (draft-free chain, no PO link).
  {
    id: 'inv3',
    direction: 'issued',
    number: 'INV-260028',
    status: 'Paid',
    date: '2026-05-10',
    client_name: 'UT Southwestern Medical Center',
    address: '5323 Harry Hines Blvd, Dallas, TX 75390',
    payment_terms: 'Net 30',
    taxable: false,
    tax_rate: 0,
    payments_credits: 6240,
    line_items: [
      calcItem({ id: 'il5', job_code: 'Medical Physics Services', description: 'Annual physics survey', qty: 24, rate: 260 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-05-10T09:00:00Z',
    updated_at: '2026-06-01T09:00:00Z',
  },
  // Received (contractor) invoice against our issued sub-PO po3, with a
  // mandatory engagement link back to client PO po1 (contractors-side chain).
  {
    id: 'inv4',
    direction: 'received',
    number: 'SUB-INV-7781',
    status: 'Unpaid',
    date: '2026-06-15',
    po_id: 'po3',
    po_number: 'PO-260011',
    proposal_id: 'rp2',
    proposal_number: '2026-0091',
    client_name: 'Tom Becker',
    address: '188 Industrial Blvd, San Antonio, TX 78201',
    project_no: 'PRJ-GAMMA-01',
    payment_terms: 'Net 15',
    taxable: true,
    tax_rate: 0.0825,
    payments_credits: 0,
    line_items: [
      calcItem({ id: 'il6', job_code: 'Relocate', description: 'Rigging crew (2 days)', qty: 2, rate: 3200 }),
      calcItem({ id: 'il7', job_code: 'Transportation', description: 'Flatbed transport', qty: null, rate: 1850 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    linked_client_po_id: 'po1',
    created_at: '2026-06-15T09:00:00Z',
    updated_at: '2026-06-15T09:00:00Z',
  },
  // Received invoice linked to an owner invoice only (no PO) — proves the
  // "at least one" engagement rule accepts the owner-invoice link alone (§5.2).
  {
    id: 'inv5',
    direction: 'received',
    number: '4500987001',
    status: 'Partially Paid',
    date: '2026-06-28',
    client_name: 'Raj Patel',
    address: '4200 Westheimer Rd, Houston, TX 77027',
    payment_terms: 'Net 30',
    taxable: false,
    tax_rate: 0,
    payments_credits: 500,
    line_items: [
      calcItem({ id: 'il8', job_code: 'Service', description: 'On-site calibration labor', qty: 12, rate: 140 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    linked_owner_invoice_id: 'inv1',
    created_at: '2026-06-28T09:00:00Z',
    updated_at: '2026-07-01T09:00:00Z',
  },
]

const INVOICES: Invoice[] = INVOICE_SEED
INVOICES.forEach(recomputeTotals)

// ── Helpers ───────────────────────────────────────────────────────────────────

function toListItem(inv: Invoice): InvoiceListItem {
  const codes = new Set<JobCode>()
  inv.line_items.forEach((li) => { if (li.job_code) codes.add(li.job_code) })
  const balance = computeBalanceDue(inv.total, inv.payments_credits)
  const dueDate = inv.date ? computeDueDate(inv.date, termDelay(inv.payment_terms)) : ''
  return {
    id: inv.id,
    number: inv.number,
    direction: inv.direction,
    status: inv.status,
    date: inv.date,
    client_name: inv.client_name,
    po_id: inv.po_id,
    po_number: inv.po_number,
    proposal_id: inv.proposal_id,
    linked_client_po_id: inv.linked_client_po_id,
    linked_owner_invoice_id: inv.linked_owner_invoice_id,
    total: inv.total,
    balance_due: balance,
    due_date: dueDate,
    is_overdue: computeIsOverdue(inv.status, dueDate),
    job_codes: Array.from(codes),
  }
}

function matchesParams(inv: Invoice, params: InvoiceListParams): boolean {
  if (inv.direction !== params.direction) return false
  if (params.q) {
    const q = params.q.toLowerCase()
    const inNumber = inv.number.toLowerCase().includes(q)
    const inPO = (inv.po_number ?? '').toLowerCase().includes(q)
    const inClient = inv.client_name.toLowerCase().includes(q)
    if (!inNumber && !inPO && !inClient) return false
  }
  if (params.status?.length && !params.status.includes(inv.status)) return false
  if (params.overdue) {
    const dueDate = inv.date ? computeDueDate(inv.date, termDelay(inv.payment_terms)) : ''
    if (!computeIsOverdue(inv.status, dueDate)) return false
  }
  if (params.from && inv.date < params.from) return false
  if (params.to && inv.date > params.to) return false
  if (params.client && !inv.client_name.toLowerCase().includes(params.client.toLowerCase())) return false
  if (params.job_code?.length) {
    const codes = new Set<JobCode>()
    inv.line_items.forEach((li) => { if (li.job_code) codes.add(li.job_code) })
    if (!params.job_code.some((c) => codes.has(c))) return false
  }
  return true
}

// ── API mock functions ────────────────────────────────────────────────────────

export function mockListInvoices(params: InvoiceListParams = { direction: 'issued' }): Promise<{
  items: InvoiceListItem[]
  total: number
  page: number
  page_size: number
}> {
  const filtered = INVOICES
    .filter((inv) => matchesParams(inv, params))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
  const page = params.page ?? 1
  const page_size = params.page_size ?? 50
  const start = (page - 1) * page_size
  const items = filtered.slice(start, start + page_size).map(toListItem)
  return delay({ items, total: filtered.length, page, page_size })
}

export function mockGetInvoice(id: string): Promise<Invoice | null> {
  return delay(INVOICES.find((inv) => inv.id === id) ?? null)
}

export function mockNextInvoiceNumber(): Promise<string> {
  return delay(previewNextNumber())
}

/** Invoice ids that link (via po_id) to the given PO — powers PO delete guard /
 *  cancel cascade once cross-links are wired (Phase 7). */
export function mockInvoiceIdsForPO(poId: string): Promise<string[]> {
  return delay(INVOICES.filter((inv) => inv.po_id === poId).map((inv) => inv.id))
}

function buildFromPayload(id: string, payload: InvoicePayload, existing?: Invoice): Invoice {
  const now = new Date().toISOString()
  const inv: Invoice = {
    id,
    direction: existing?.direction ?? payload.direction,
    number: payload.number || existing?.number || '',
    status: payload.status,
    date: payload.date,
    po_id: payload.po_id,
    po_number: payload.po_number,
    proposal_id: payload.proposal_id,
    proposal_number: payload.proposal_number,
    client_name: payload.client_name,
    address: payload.address,
    title: payload.title,
    business_name: payload.business_name,
    department: payload.department,
    phone: payload.phone,
    email: payload.email,
    project_no: payload.project_no,
    agreement_no: payload.agreement_no,
    ship_date: payload.ship_date,
    payment_terms: payload.payment_terms,
    taxable: payload.taxable,
    tax_rate: payload.taxable ? payload.tax_rate : 0,
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    payments_credits: payload.payments_credits ?? 0,
    line_items: payload.line_items.map((li) => calcItem({ ...li, id: mkId() })),
    notes: payload.notes,
    linked_client_po_id: payload.linked_client_po_id,
    linked_owner_invoice_id: payload.linked_owner_invoice_id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }
  recomputeTotals(inv)
  return inv
}

export function mockCreateInvoice(payload: InvoicePayload): Promise<Invoice> {
  if (payload.number && INVOICES.some((inv) => inv.number === payload.number && inv.direction === payload.direction)) {
    return Promise.reject({ status: 409, message: 'Invoice number already exists' })
  }
  const number = payload.number || generateNumber()
  const inv = buildFromPayload(mkId(), { ...payload, number })
  INVOICES.push(inv)
  return delay(inv)
}

export function mockUpdateInvoice(id: string, payload: InvoicePayload): Promise<Invoice> {
  const idx = INVOICES.findIndex((inv) => inv.id === id)
  if (idx === -1) return Promise.reject({ status: 404 })
  const updated = buildFromPayload(id, payload, INVOICES[idx])
  INVOICES[idx] = updated
  return delay(updated)
}

export function mockDeleteInvoice(id: string): Promise<void> {
  const idx = INVOICES.findIndex((inv) => inv.id === id)
  if (idx !== -1) INVOICES.splice(idx, 1)
  return delay(undefined)
}

export function mockUpdateInvoiceStatus(id: string, status: Invoice['status']): Promise<Invoice> {
  const inv = INVOICES.find((x) => x.id === id)
  if (!inv) return Promise.reject({ status: 404 })
  inv.status = status
  inv.updated_at = new Date().toISOString()
  return delay({ ...inv })
}

/** Mark Paid quick action (§5.1): payments_credits = total, status = Paid. */
export function mockMarkInvoicePaid(id: string): Promise<Invoice> {
  const inv = INVOICES.find((x) => x.id === id)
  if (!inv) return Promise.reject({ status: 404 })
  inv.payments_credits = inv.total
  inv.status = 'Paid'
  inv.updated_at = new Date().toISOString()
  return delay({ ...inv })
}

export function mockGenerateDocument(id: string): Promise<Blob> {
  const inv = INVOICES.find((x) => x.id === id)
  const content = `Invoice\n\nNumber: ${inv?.number ?? id}\nGenerated: ${new Date().toISOString()}\n\n[Backend required for real .docx generation]`
  return delay(new Blob([content], { type: 'text/plain' }))
}
