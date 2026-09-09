import type {
  JobCode,
  PurchaseOrder,
  POLineItem,
  POListItem,
  POListParams,
  POPayload,
} from '../types/purchaseOrder'
import { mockInvoiceIdsForPO } from './invoices'

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function mkId() {
  return Math.random().toString(36).slice(2)
}

// ── Line-item computation (same formula as Standard proposals, spec §3.2) ─────

function computeAmount(qty: number | null, rate: number): number {
  if (qty === null || qty === undefined) return rate
  return qty * rate
}

function calcItem(item: Omit<POLineItem, 'amount'>): POLineItem {
  return { ...item, amount: computeAmount(item.qty, item.rate) }
}

function recomputeTotals(p: PurchaseOrder) {
  p.subtotal = p.line_items.reduce((s, i) => s + i.amount, 0)
  p.sales_tax = p.taxable ? p.subtotal * p.tax_rate : 0
  p.total = p.subtotal + p.sales_tax
}

// ── Numbering (issued only; spec §8) ──────────────────────────────────────────
// Issued POs: PO-YY#### auto. Received POs carry the counterparty's number.

let nextIssuedNum = 12   // PO-260011 / PO-260012 exist → next is PO-260013

function generateNumber(yy = '26'): string {
  nextIssuedNum++
  return `PO-${yy}${String(nextIssuedNum).padStart(4, '0')}`
}

function previewNextNumber(yy = '26'): string {
  return `PO-${yy}${String(nextIssuedNum + 1).padStart(4, '0')}`
}

// ── Fixtures (spec §3.5) ──────────────────────────────────────────────────────

const PO_SEED: PurchaseOrder[] = [
  // Received PO answering our issued Standard proposal Q-260003 (external number)
  {
    id: 'po1',
    direction: 'received',
    number: '4500123977',
    status: 'Approved',
    date: '2026-04-02',
    proposal_id: 'p3',
    proposal_number: 'Q-260003',
    client_name: 'Gamma Health Systems',
    address: '300 Elm Rd, San Antonio, TX',
    project_no: 'PRJ-GAMMA-01',
    agreement_no: 'AGR-2026-003',
    payment_terms: 'Net 30',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcItem({ id: 'pol1', job_code: 'System', description: 'Full system overhaul', qty: 1, rate: 18000 }),
      calcItem({ id: 'pol2', job_code: 'Decommissioning', description: 'Decommission old unit', qty: 1, rate: 2500 }),
      calcItem({ id: 'pol3', job_code: 'Transportation', description: 'Transportation', qty: null, rate: 1200 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Client PO issued against our accepted proposal.</p>',
    created_at: '2026-04-02T09:00:00Z',
    updated_at: '2026-04-02T09:00:00Z',
  },
  // Received PO answering our issued MP proposal PQ-260003
  {
    id: 'po2',
    direction: 'received',
    number: 'CPO-2026-88',
    status: 'Open',
    date: '2026-03-22',
    proposal_id: 'p7',
    proposal_number: 'PQ-260003',
    client_name: 'UT Southwestern Medical Center',
    address: '5323 Harry Hines Blvd, Dallas, TX 75390',
    project_no: 'PRJ-UTSW-07',
    payment_terms: 'Net 45',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcItem({ id: 'pol4', job_code: 'Medical Physics Services', description: 'Medical physics survey', qty: 24, rate: 260 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-03-22T13:00:00Z',
    updated_at: '2026-03-24T09:00:00Z',
  },
  // Issued (sub) PO to a contractor, linked to received proposal 2026-0091,
  // with an engagement link back to a client PO.
  {
    id: 'po3',
    direction: 'issued',
    number: 'PO-260011',
    status: 'Approved',
    date: '2026-05-04',
    proposal_id: 'rp2',
    proposal_number: '2026-0091',
    client_name: 'Tom Becker',
    address: '188 Industrial Blvd, San Antonio, TX 78201',
    project_no: 'PRJ-GAMMA-01',
    ship_to: 'Gamma Health Systems — San Antonio',
    payment_terms: 'Net 30',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcItem({ id: 'pol5', job_code: 'Relocate', description: 'Rigging crew (2 days)', qty: 2, rate: 3200 }),
      calcItem({ id: 'pol6', job_code: 'Transportation', description: 'Flatbed transport', qty: null, rate: 1850 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    linked_client_po_id: 'po1',
    created_at: '2026-05-04T10:00:00Z',
    updated_at: '2026-05-04T10:00:00Z',
  },
  // Canceled issued PO, no proposal link
  {
    id: 'po4',
    direction: 'issued',
    number: 'PO-260012',
    status: 'Canceled',
    date: '2026-05-10',
    client_name: 'Raj Patel',
    address: '4200 Westheimer Rd, Houston, TX 77027',
    payment_terms: 'Due On Receipt',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcItem({ id: 'pol7', job_code: 'Service', description: 'On-site calibration labor', qty: 12, rate: 140 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Canceled — scope moved in-house.</p>',
    created_at: '2026-05-10T08:00:00Z',
    updated_at: '2026-05-12T08:00:00Z',
  },
  // Received PO, no proposal link (minimal, single line item)
  {
    id: 'po5',
    direction: 'received',
    number: 'PO-ACME-501',
    status: 'Fulfilled',
    date: '2026-04-30',
    client_name: 'Acme Medical Center',
    address: '100 Main St, Austin, TX',
    payment_terms: 'Net 15',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcItem({ id: 'pol8', job_code: 'Parts', description: 'Replacement coil', qty: 1, rate: 4500 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-04-30T11:00:00Z',
    updated_at: '2026-05-02T11:00:00Z',
  },
]

const POS: PurchaseOrder[] = PO_SEED
POS.forEach(recomputeTotals)

// ── Helpers ───────────────────────────────────────────────────────────────────

function toListItem(p: PurchaseOrder): POListItem {
  const codes = new Set<JobCode>()
  p.line_items.forEach((li) => { if (li.job_code) codes.add(li.job_code) })
  return {
    id: p.id,
    number: p.number,
    direction: p.direction,
    status: p.status,
    date: p.date,
    client_name: p.client_name,
    proposal_id: p.proposal_id,
    proposal_number: p.proposal_number,
    total: p.total,
    job_codes: Array.from(codes),
  }
}

function matchesParams(p: PurchaseOrder, params: POListParams): boolean {
  if (p.direction !== params.direction) return false
  if (params.q) {
    const q = params.q.toLowerCase()
    const inNumber = p.number.toLowerCase().includes(q)
    const inProposal = (p.proposal_number ?? '').toLowerCase().includes(q)
    const inClient = p.client_name.toLowerCase().includes(q)
    if (!inNumber && !inProposal && !inClient) return false
  }
  if (params.status?.length && !params.status.includes(p.status)) return false
  if (params.from && p.date < params.from) return false
  if (params.to && p.date > params.to) return false
  if (params.client) {
    if (!p.client_name.toLowerCase().includes(params.client.toLowerCase())) return false
  }
  if (params.job_code?.length) {
    const codes = new Set<JobCode>()
    p.line_items.forEach((li) => { if (li.job_code) codes.add(li.job_code) })
    if (!params.job_code.some((c) => codes.has(c))) return false
  }
  return true
}

// ── API mock functions ────────────────────────────────────────────────────────

export function mockListPOs(params: POListParams = { direction: 'received' }): Promise<{
  items: POListItem[]
  total: number
  page: number
  page_size: number
}> {
  const filtered = POS
    .filter((p) => matchesParams(p, params))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
  const page = params.page ?? 1
  const page_size = params.page_size ?? 50
  const start = (page - 1) * page_size
  const items = filtered.slice(start, start + page_size).map(toListItem)
  return delay({ items, total: filtered.length, page, page_size })
}

export function mockGetPO(id: string): Promise<PurchaseOrder | null> {
  return delay(POS.find((p) => p.id === id) ?? null)
}

export function mockNextPONumber(): Promise<string> {
  return delay(previewNextNumber())
}

/**
 * Invoices that link to this PO (via po_id). Wired to the invoices store in
 * Phase 7; used by the delete guard and cancel-cascade warning (§7).
 */
export function mockPOLinkedInvoiceIds(poId: string): Promise<string[]> {
  return mockInvoiceIdsForPO(poId)
}

function buildFromPayload(id: string, payload: POPayload, existing?: PurchaseOrder): PurchaseOrder {
  const now = new Date().toISOString()
  const p: PurchaseOrder = {
    id,
    direction: existing?.direction ?? payload.direction,
    number: payload.number || existing?.number || '',
    status: payload.status,
    date: payload.date,
    proposal_id: payload.proposal_id,
    proposal_number: payload.proposal_number,
    client_name: payload.client_name,
    address: payload.address,
    project_no: payload.project_no,
    agreement_no: payload.agreement_no,
    ship_date: payload.ship_date,
    ship_to: payload.ship_to,
    payment_terms: payload.payment_terms,
    taxable: payload.taxable,
    tax_rate: payload.taxable ? payload.tax_rate : 0,
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    line_items: payload.line_items.map((li) => calcItem({ ...li, id: mkId() })),
    notes: payload.notes,
    linked_client_po_id: payload.linked_client_po_id,
    linked_owner_invoice_id: payload.linked_owner_invoice_id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }
  recomputeTotals(p)
  return p
}

export function mockCreatePO(payload: POPayload): Promise<PurchaseOrder> {
  if (payload.number && POS.some((p) => p.number === payload.number && p.direction === payload.direction)) {
    return Promise.reject({ status: 409, message: 'PO number already exists' })
  }
  const number = payload.number || generateNumber()
  const p = buildFromPayload(mkId(), { ...payload, number })
  POS.push(p)
  return delay(p)
}

export function mockUpdatePO(id: string, payload: POPayload): Promise<PurchaseOrder> {
  const idx = POS.findIndex((p) => p.id === id)
  if (idx === -1) return Promise.reject({ status: 404 })
  // Direction is locked after first save.
  const updated = buildFromPayload(id, payload, POS[idx])
  POS[idx] = updated
  return delay(updated)
}

export async function mockDeletePO(id: string): Promise<void> {
  const linked = await mockPOLinkedInvoiceIds(id)
  if (linked.length) {
    return Promise.reject({ status: 409, message: 'PO has linked invoices', linked })
  }
  const idx = POS.findIndex((p) => p.id === id)
  if (idx !== -1) POS.splice(idx, 1)
  return delay(undefined)
}

export function mockUpdatePOStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder> {
  const p = POS.find((x) => x.id === id)
  if (!p) return Promise.reject({ status: 404 })
  p.status = status
  p.updated_at = new Date().toISOString()
  return delay({ ...p })
}

export function mockGenerateDocument(id: string): Promise<Blob> {
  const p = POS.find((x) => x.id === id)
  const content = `Purchase Order\n\nNumber: ${p?.number ?? id}\nGenerated: ${new Date().toISOString()}\n\n[Backend required for real .docx generation]`
  return delay(new Blob([content], { type: 'text/plain' }))
}

export function mockPreviewDocument(_id: string): Promise<null> {
  return delay(null)
}
