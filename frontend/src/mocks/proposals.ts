import type {
  JobCode,
  Proposal,
  ProposalListItem,
  ProposalListParams,
  ProposalPayload,
  ProposalType,
  StandardLineItem,
  MPLineItem,
} from '../types/proposal'

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function mkId() {
  return Math.random().toString(36).slice(2)
}

// ── Line-item computation (spec §4.4) ────────────────────────────────────────

function computeStandardAmount(qty: number | null, rate: number): number {
  // qty IS NULL  → amount = rate (lump-sum)
  // qty = 0     → amount = 0
  if (qty === null || qty === undefined) return rate
  return qty * rate
}

function computeMPFee(hourlyRate: number | null, hours: number): number {
  // hourly_rate IS NULL → estimated_fee = hours_estimated (lump-sum)
  if (hourlyRate === null || hourlyRate === undefined) return hours
  return hourlyRate * hours
}

function calcStandardItem(item: Omit<StandardLineItem, 'amount'>): StandardLineItem {
  return { ...item, amount: computeStandardAmount(item.qty, item.rate) }
}

function calcMPItem(item: Omit<MPLineItem, 'estimated_fee'>): MPLineItem {
  return { ...item, estimated_fee: computeMPFee(item.hourly_rate, item.hours_estimated) }
}

function recomputeTotals(p: Proposal) {
  if (p.type === 'Standard') {
    const items = p.line_items as StandardLineItem[]
    p.subtotal = items.reduce((s, i) => s + i.amount, 0)
    p.sales_tax = p.taxable ? p.subtotal * p.tax_rate : 0
    p.total = p.subtotal + p.sales_tax
  } else {
    const items = p.line_items as MPLineItem[]
    p.subtotal = items.reduce((s, i) => s + i.estimated_fee, 0)
    p.sales_tax = p.taxable ? p.subtotal * p.tax_rate : 0
    p.total = p.subtotal + p.sales_tax
  }
}

// ── Numbering (spec §3) ──────────────────────────────────────────────────────

let nextStandardNum = 8   // Next would be Q-260009
let nextMPNum = 4         // Next would be PQ-260005

function generateNumber(type: ProposalType, yy = '26'): string {
  if (type === 'Standard') {
    nextStandardNum++
    return `Q-${yy}${String(nextStandardNum).padStart(4, '0')}`
  }
  nextMPNum++
  return `PQ-${yy}${String(nextMPNum).padStart(4, '0')}`
}

function previewNextNumber(type: ProposalType, yy = '26'): string {
  if (type === 'Standard') {
    return `Q-${yy}${String(nextStandardNum + 1).padStart(4, '0')}`
  }
  return `PQ-${yy}${String(nextMPNum + 1).padStart(4, '0')}`
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROPOSAL_SEED: Omit<Proposal, 'direction'>[] = [
  // Q-260001: Standard, Draft
  {
    id: 'p1',
    number: 'Q-260001',
    type: 'Standard',
    status: 'Draft',
    date: '2026-04-10',
    client_name: 'Acme Medical Center',
    address: '100 Main St, Austin, TX',
    title: 'Director of Imaging',
    business_name: 'Acme Medical Center',
    department: 'Radiology',
    phone: '(512) 555-0100',
    email: 'imaging@acmemed.example',
    project_no: 'PRJ-2026-A001',
    project_name: 'MRI Suite Renovation',
    agreement_no: 'AGR-2026-001',
    proposal_valid_till: '2026-05-10',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcStandardItem({ id: 'li1', job_code: 'Service', description: 'Field service visit', qty: 2, rate: 1200 }),
      calcStandardItem({ id: 'li2', job_code: 'Parts', description: 'Replacement coil', qty: 1, rate: 4500 }),
      calcStandardItem({ id: 'li3', job_code: 'Shipping', description: 'Freight shipping', qty: null, rate: 350 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Client prefers morning appointments.</p>',
    created_at: '2026-04-10T09:00:00Z',
    updated_at: '2026-04-10T09:00:00Z',
  },
  // Q-260002: Standard, Sent
  {
    id: 'p2',
    number: 'Q-260002',
    type: 'Standard',
    status: 'Sent',
    date: '2026-04-15',
    client_name: 'Beta Radiology Group',
    address: '55 Park Blvd, Dallas, TX',
    title: 'Lead Tech',
    business_name: 'Beta Radiology Group',
    department: 'Operations',
    phone: '(214) 555-0202',
    email: 'ops@betarad.example',
    project_name: 'CT Scanner Annual PM',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcStandardItem({ id: 'li5', job_code: 'Service', description: 'PM service', qty: 1, rate: 2800 }),
      calcStandardItem({ id: 'li6', job_code: 'Travel', description: 'Travel expense', qty: null, rate: 450 }),
      calcStandardItem({ id: 'li7', job_code: 'Rental', description: 'Tube rental', qty: 3, rate: 600 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-04-15T10:00:00Z',
    updated_at: '2026-04-16T08:00:00Z',
  },
  // Q-260003: Standard, Accepted
  {
    id: 'p3',
    number: 'Q-260003',
    type: 'Standard',
    status: 'Accepted',
    date: '2026-03-20',
    client_name: 'Gamma Health Systems',
    address: '300 Elm Rd, San Antonio, TX',
    title: 'CFO',
    business_name: 'Gamma Health Systems',
    department: 'Finance',
    phone: '(210) 555-0303',
    email: 'cfo@gammahealth.example',
    project_name: 'Linear Accelerator Overhaul',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcStandardItem({ id: 'li8', job_code: 'System', description: 'Full system overhaul', qty: 1, rate: 18000 }),
      calcStandardItem({ id: 'li9', job_code: 'Decommissioning', description: 'Decommission old unit', qty: 1, rate: 2500 }),
      calcStandardItem({ id: 'li10', job_code: 'Transportation', description: 'Transportation', qty: null, rate: 1200 }),
      calcStandardItem({ id: 'li11', job_code: 'Discount', description: 'Volume discount', qty: 1, rate: -1000 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Rush job approved by management.</p>',
    created_at: '2026-03-20T14:00:00Z',
    updated_at: '2026-03-25T09:00:00Z',
  },
  // Q-260004: Standard, Declined, non-taxable
  {
    id: 'p4',
    number: 'Q-260004',
    type: 'Standard',
    status: 'Declined',
    date: '2026-03-05',
    client_name: 'Delta Imaging LLC',
    address: '12 River Dr, El Paso, TX',
    title: 'Owner',
    business_name: 'Delta Imaging LLC',
    phone: '(915) 555-0404',
    email: 'owner@deltaimg.example',
    project_name: 'X-Ray Equipment Sales',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcStandardItem({ id: 'li14', job_code: 'Sales', description: 'X-Ray unit sale', qty: 1, rate: 12000 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-03-05T11:00:00Z',
    updated_at: '2026-03-10T11:00:00Z',
  },
  // PQ-260001: MP, Draft (Taxable default No)
  {
    id: 'p5',
    number: 'PQ-260001',
    type: 'MP',
    status: 'Draft',
    date: '2026-04-20',
    reference: 'REF-MP-001',
    project_location: 'Memorial Hermann Hospital',
    address: '6411 Fannin St, Houston, TX 77030',
    project_type: 'Quarterly QA',
    project_name: 'Memorial Q2 QA Program',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcMPItem({ id: 'li16', job_code: 'Medical Physics Services', services: 'Physics consultation', hourly_rate: 250, hours_estimated: 8 }),
      calcMPItem({ id: 'li17', job_code: 'Medical Physics Services', services: 'Travel to site', hourly_rate: null, hours_estimated: 300 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Quarterly QA program.</p>',
    services_provided: '<ul><li>Dosimetry measurements</li><li>Machine QA</li></ul>',
    created_at: '2026-04-20T08:00:00Z',
    updated_at: '2026-04-20T08:00:00Z',
  },
  // PQ-260002: MP, Sent
  {
    id: 'p6',
    number: 'PQ-260002',
    type: 'MP',
    status: 'Sent',
    date: '2026-04-22',
    reference: 'REF-MP-002',
    project_location: 'MD Anderson Cancer Center',
    address: '1515 Holcombe Blvd, Houston, TX 77030',
    project_type: 'Annual Survey',
    project_name: 'MDA Annual Physics Survey',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcMPItem({ id: 'li18', job_code: 'Medical Physics Services', services: 'Physics services', hourly_rate: 275, hours_estimated: 16 }),
      calcMPItem({ id: 'li19', job_code: 'Medical Physics Services', services: 'Equipment relocation', hourly_rate: null, hours_estimated: 1500 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    services_provided: '<p>Comprehensive physics services per AAPM TG-100.</p>',
    created_at: '2026-04-22T09:00:00Z',
    updated_at: '2026-04-23T10:00:00Z',
  },
  // PQ-260003: MP, Accepted
  {
    id: 'p7',
    number: 'PQ-260003',
    type: 'MP',
    status: 'Accepted',
    date: '2026-03-15',
    reference: 'REF-MP-003',
    project_location: 'UT Southwestern Medical Center',
    address: '5323 Harry Hines Blvd, Dallas, TX 75390',
    project_type: 'Site Survey',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcMPItem({ id: 'li22', job_code: 'Medical Physics Services', services: 'Medical physics survey', hourly_rate: 260, hours_estimated: 24 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-03-15T13:00:00Z',
    updated_at: '2026-03-20T09:00:00Z',
  },
  // Q-260005: Standard, empty draft
  {
    id: 'p8',
    number: 'Q-260005',
    type: 'Standard',
    status: 'Draft',
    date: '2026-05-01',
    client_name: 'Acme Medical Center',
    address: '200 Oak Ave, Houston, TX',
    title: 'Facilities Manager',
    business_name: 'Acme Medical Center',
    department: 'Facilities',
    phone: '(713) 555-0101',
    email: 'facilities@acmemed.example',
    project_name: 'Empty Draft',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-05-01T07:00:00Z',
    updated_at: '2026-05-01T07:00:00Z',
  },
]

// ── Received fixtures (contractors side) ──────────────────────────────────────
// External numbers (free text), received status set, contractor counterparties.
// MP-format received proposals carry no counterparty field (same as MP issued).
const RECEIVED_SEED: Omit<Proposal, 'direction'>[] = [
  // Standard received, status Received
  {
    id: 'rp1',
    number: 'PCS-4471',
    type: 'Standard',
    status: 'Received',
    date: '2026-05-02',
    client_name: 'Raj Patel',
    address: '4200 Westheimer Rd, Houston, TX 77027',
    business_name: 'Precision Calibration Services',
    title: 'Field Engineer',
    phone: '(713) 555-0710',
    email: 'raj@precisioncal.example',
    project_name: 'Annual Calibration — Houston Sites',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcStandardItem({ id: 'rli1', job_code: 'Service', description: 'On-site calibration labor', qty: 12, rate: 140 }),
      calcStandardItem({ id: 'rli2', job_code: 'Travel', description: 'Travel & per diem', qty: null, rate: 480 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    notes: '<p>Contractor quote for the annual calibration cycle.</p>',
    created_at: '2026-05-02T09:00:00Z',
    updated_at: '2026-05-02T09:00:00Z',
  },
  // Standard received, status Accepted
  {
    id: 'rp2',
    number: '2026-0091',
    type: 'Standard',
    status: 'Accepted',
    date: '2026-04-28',
    client_name: 'Tom Becker',
    address: '188 Industrial Blvd, San Antonio, TX 78201',
    business_name: 'Rigging & Transport Co',
    title: 'Operations Lead',
    phone: '(210) 555-0933',
    email: 'tom@rigtransport.example',
    project_name: 'LINAC Relocation — Rigging',
    taxable: true,
    tax_rate: 0.0825,
    line_items: [
      calcStandardItem({ id: 'rli3', job_code: 'Relocate', description: 'Rigging crew (2 days)', qty: 2, rate: 3200 }),
      calcStandardItem({ id: 'rli4', job_code: 'Transportation', description: 'Flatbed transport', qty: null, rate: 1850 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-04-28T10:00:00Z',
    updated_at: '2026-05-01T14:00:00Z',
  },
  // MP received, status Received
  {
    id: 'rp3',
    number: 'PHYS-2026-07',
    type: 'MP',
    status: 'Received',
    date: '2026-05-06',
    reference: 'Proposal for Medical Physicist Professional Services',
    project_location: 'MD Anderson Cancer Center',
    address: '1515 Holcombe Blvd, Houston, TX 77030',
    project_type: 'Contracted Survey',
    project_name: 'Subcontracted Physics Survey',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcMPItem({ id: 'rli5', job_code: 'Medical Physics Services', services: 'Independent physics survey', hourly_rate: 240, hours_estimated: 20 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    services_provided: '<p>Subcontracted survey per AAPM guidelines.</p>',
    created_at: '2026-05-06T08:00:00Z',
    updated_at: '2026-05-06T08:00:00Z',
  },
  // MP received, status Declined
  {
    id: 'rp4',
    number: 'PHYS-2026-09',
    type: 'MP',
    status: 'Declined',
    date: '2026-04-18',
    reference: 'Proposal for Medical Physicist',
    project_location: 'UT Southwestern Medical Center',
    address: '5323 Harry Hines Blvd, Dallas, TX 75390',
    project_type: 'Consulting',
    taxable: false,
    tax_rate: 0,
    line_items: [
      calcMPItem({ id: 'rli6', job_code: 'Medical Physics Services', services: 'Consulting retainer', hourly_rate: null, hours_estimated: 5000 }),
    ],
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: '2026-04-18T11:00:00Z',
    updated_at: '2026-04-22T09:00:00Z',
  },
]

const PROPOSALS: Proposal[] = [
  ...PROPOSAL_SEED.map((p): Proposal => ({ ...p, direction: 'issued' })),
  ...RECEIVED_SEED.map((p): Proposal => ({ ...p, direction: 'received' })),
]

// Recompute totals for all proposals
PROPOSALS.forEach(recomputeTotals)

// ── Helpers ───────────────────────────────────────────────────────────────────

function toListItem(p: Proposal): ProposalListItem {
  const codes = new Set<JobCode>()
  p.line_items.forEach((li) => { if (li.job_code) codes.add(li.job_code as JobCode) })
  return {
    id: p.id,
    number: p.number,
    type: p.type,
    direction: p.direction,
    status: p.status,
    date: p.date,
    client_name: p.client_name,
    project_name: p.project_name,
    project_location: p.project_location,
    total: p.total,
    job_codes: Array.from(codes),
  }
}

function matchesParams(p: Proposal, params: ProposalListParams): boolean {
  if (p.direction !== params.direction) return false
  if (params.q) {
    const q = params.q.toLowerCase()
    const matchNum = p.number.toLowerCase().includes(q)
    const matchName = (p.project_name ?? '').toLowerCase().includes(q)
    if (!matchNum && !matchName) return false
  }
  if (params.status?.length) {
    if (!params.status.includes(p.status)) return false
  }
  if (params.type) {
    if (p.type !== params.type) return false
  }
  if (params.from && p.date < params.from) return false
  if (params.to && p.date > params.to) return false
  if (params.client) {
    const q = params.client.toLowerCase()
    const matchClient = (p.client_name ?? '').toLowerCase().includes(q)
    const matchLoc = (p.project_location ?? '').toLowerCase().includes(q)
    if (!matchClient && !matchLoc) return false
  }
  if (params.job_code?.length) {
    const codes = new Set<JobCode>()
    p.line_items.forEach((li) => { if (li.job_code) codes.add(li.job_code as JobCode) })
    const hasAny = params.job_code.some((c) => codes.has(c))
    if (!hasAny) return false
  }
  return true
}

// ── API mock functions ────────────────────────────────────────────────────────

export function mockListProposals(params: ProposalListParams = { direction: 'issued' }): Promise<{
  items: ProposalListItem[]
  total: number
  page: number
  page_size: number
}> {
  const filtered = PROPOSALS
    .filter((p) => matchesParams(p, params))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
  const page = params.page ?? 1
  const page_size = params.page_size ?? 50
  const start = (page - 1) * page_size
  const items = filtered.slice(start, start + page_size).map(toListItem)
  return delay({ items, total: filtered.length, page, page_size })
}

export function mockGetProposal(id: string): Promise<Proposal | null> {
  return delay(PROPOSALS.find((p) => p.id === id) ?? null)
}

export function mockNextProposalNumber(type: ProposalType): Promise<string> {
  return delay(previewNextNumber(type))
}

export function mockCreateProposal(payload: ProposalPayload): Promise<Proposal> {
  // 409: duplicate number conflict
  const submittedNumber = payload.number
  if (submittedNumber && PROPOSALS.some((p) => p.number === submittedNumber)) {
    return Promise.reject({ status: 409, message: 'Proposal number already exists' })
  }

  const number = submittedNumber || generateNumber(payload.type)
  const id = mkId()
  const now = new Date().toISOString()

  const p: Proposal = {
    id,
    number,
    type: payload.type,
    direction: payload.direction ?? 'issued',
    linked_client_po_id: payload.linked_client_po_id,
    linked_owner_invoice_id: payload.linked_owner_invoice_id,
    status: payload.status,
    date: payload.date,
    client_name: payload.client_name,
    address: payload.address,
    title: payload.title,
    business_name: payload.business_name,
    department: payload.department,
    phone: payload.phone,
    email: payload.email,
    project_no: payload.project_no,
    project_name: payload.project_name,
    agreement_no: payload.agreement_no,
    proposal_valid_till: payload.proposal_valid_till,
    reference: payload.reference,
    project_location: payload.project_location,
    project_type: payload.project_type,
    taxable: payload.taxable,
    tax_rate: payload.tax_rate,
    notes: payload.notes,
    services_provided: payload.services_provided,
    line_items: payload.type === 'Standard'
      ? payload.line_items.map((li) => calcStandardItem({ ...(li as Omit<StandardLineItem, 'amount'>), id: mkId() }))
      : payload.line_items.map((li) => calcMPItem({ ...(li as Omit<MPLineItem, 'estimated_fee'>), id: mkId() })),
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    created_at: now,
    updated_at: now,
  }
  recomputeTotals(p)
  PROPOSALS.push(p)
  return delay(p)
}

export function mockUpdateProposal(id: string, payload: ProposalPayload): Promise<Proposal> {
  const idx = PROPOSALS.findIndex((p) => p.id === id)
  if (idx === -1) return Promise.reject({ status: 404 })

  const existing = PROPOSALS[idx]
  // Type is locked after first save
  if (payload.type !== existing.type) {
    return Promise.reject({ status: 400, message: 'Type cannot be changed' })
  }

  const now = new Date().toISOString()
  const p: Proposal = {
    ...existing,
    number: payload.number || existing.number,
    status: payload.status,
    date: payload.date,
    client_name: payload.client_name,
    address: payload.address,
    title: payload.title,
    business_name: payload.business_name,
    department: payload.department,
    phone: payload.phone,
    email: payload.email,
    project_no: payload.project_no,
    project_name: payload.project_name,
    agreement_no: payload.agreement_no,
    proposal_valid_till: payload.proposal_valid_till,
    reference: payload.reference,
    project_location: payload.project_location,
    project_type: payload.project_type,
    taxable: payload.taxable,
    tax_rate: payload.tax_rate,
    notes: payload.notes,
    services_provided: payload.services_provided,
    line_items: existing.type === 'Standard'
      ? payload.line_items.map((li) => calcStandardItem({ ...(li as Omit<StandardLineItem, 'amount'>), id: mkId() }))
      : payload.line_items.map((li) => calcMPItem({ ...(li as Omit<MPLineItem, 'estimated_fee'>), id: mkId() })),
    subtotal: 0,
    sales_tax: 0,
    total: 0,
    updated_at: now,
  }
  recomputeTotals(p)
  PROPOSALS[idx] = p
  return delay(p)
}

export function mockDeleteProposal(id: string): Promise<void> {
  const idx = PROPOSALS.findIndex((p) => p.id === id)
  if (idx !== -1) PROPOSALS.splice(idx, 1)
  return delay(undefined)
}

export function mockUpdateProposalStatus(id: string, status: Proposal['status']): Promise<Proposal> {
  const p = PROPOSALS.find((p) => p.id === id)
  if (!p) return Promise.reject({ status: 404 })
  p.status = status
  p.updated_at = new Date().toISOString()
  return delay({ ...p })
}

export function mockGenerateDocument(id: string): Promise<Blob> {
  const p = PROPOSALS.find((x) => x.id === id)
  const content = `Proposal Document\n\nNumber: ${p?.number ?? id}\nGenerated: ${new Date().toISOString()}\n\n[Backend required for real .docx generation]`
  return delay(new Blob([content], { type: 'text/plain' }))
}

export function mockPreviewDocument(_id: string): Promise<null> {
  return delay(null)
}
