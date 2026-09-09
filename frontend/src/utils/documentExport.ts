import { mockGetProposal } from '../mocks/proposals'
import { mockGetPO } from '../mocks/purchaseOrders'
import { mockGetInvoice } from '../mocks/invoices'
import type { Proposal, StandardLineItem, MPLineItem } from '../types/proposal'
import type { PurchaseOrder } from '../types/purchaseOrder'
import type { Invoice } from '../types/invoice'

/**
 * Document CSV export (followup spec §3.1). Documents flatten to **one row per
 * line item** — the legacy-archive shape — so exports line up with the .xlsm
 * archives during migration reconciliation. Header columns repeat on every row,
 * plus `Item Order` and the item columns.
 *
 * Mock stage: full documents (with line items) are fetched from the mock store
 * by id. When the backend lands, swap these getters for the export endpoint.
 */

export type DocModule = 'proposals' | 'pos' | 'invoices'

function escapeCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function money(n: number | undefined): string {
  return n === undefined || n === null ? '' : n.toFixed(2)
}
function pct(n: number | undefined): string {
  return n === undefined || n === null ? '' : (n * 100).toFixed(4)
}
function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v)
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const r of rows) lines.push(r.map(escapeCell).join(','))
  return lines.join('\r\n')
}

// ── Per-module flatteners ─────────────────────────────────────────────────────

const PROPOSAL_HEADERS = [
  'Proposal #', 'Type', 'Direction', 'Status', 'Date', 'Client/Contractor', 'Project Location',
  'Project Name', 'Address', 'Taxable', 'Tax Rate %', 'Subtotal', 'Sales Tax', 'Total',
  'Item Order', 'Job Code', 'Description', 'Qty/Hours', 'Rate', 'Amount',
]
function proposalRows(p: Proposal): string[][] {
  const header = [
    p.number, p.type, p.direction, p.status, p.date,
    str(p.client_name), str(p.project_location), str(p.project_name), str(p.address),
    p.taxable ? 'Yes' : 'No', pct(p.tax_rate), money(p.subtotal), money(p.sales_tax), money(p.total),
  ]
  const items = p.line_items.length ? p.line_items : [null]
  return items.map((li, idx) => {
    if (!li) return [...header, String(idx + 1), '', '', '', '', '']
    if (p.type === 'Standard') {
      const s = li as StandardLineItem
      return [...header, String(idx + 1), str(s.job_code), s.description, str(s.qty), money(s.rate), money(s.amount)]
    }
    const m = li as MPLineItem
    return [...header, String(idx + 1), 'Medical Physics Services', m.services, str(m.hours_estimated), money(m.hourly_rate ?? undefined), money(m.estimated_fee)]
  })
}

const PO_HEADERS = [
  'PO #', 'Direction', 'Status', 'Date', 'Client/Contractor', 'Proposal #', 'Project No', 'Agreement No',
  'Ship To', 'Payment Terms', 'Taxable', 'Tax Rate %', 'Subtotal', 'Sales Tax', 'Total',
  'Item Order', 'Job Code', 'Description', 'Qty/Hours', 'Rate', 'Amount',
]
function poRows(po: PurchaseOrder): string[][] {
  const header = [
    po.number, po.direction, po.status, po.date, str(po.client_name), str(po.proposal_number),
    str(po.project_no), str(po.agreement_no), str(po.ship_to), str(po.payment_terms),
    po.taxable ? 'Yes' : 'No', pct(po.tax_rate), money(po.subtotal), money(po.sales_tax), money(po.total),
  ]
  const items = po.line_items.length ? po.line_items : [null]
  return items.map((li, idx) =>
    li
      ? [...header, String(idx + 1), str(li.job_code), li.description, str(li.qty), money(li.rate), money(li.amount)]
      : [...header, String(idx + 1), '', '', '', '', ''],
  )
}

const INVOICE_HEADERS = [
  'Invoice #', 'Direction', 'Status', 'Date', 'Client/Contractor', 'PO #', 'Proposal #', 'Project No',
  'Payment Terms', 'Taxable', 'Tax Rate %', 'Subtotal', 'Sales Tax', 'Total', 'Payments/Credits', 'Balance Due',
  'Item Order', 'Job Code', 'Description', 'Qty/Hours', 'Rate', 'Amount',
]
function invoiceRows(inv: Invoice): string[][] {
  const header = [
    inv.number, inv.direction, inv.status, inv.date, str(inv.client_name), str(inv.po_number), str(inv.proposal_number),
    str(inv.project_no), str(inv.payment_terms), inv.taxable ? 'Yes' : 'No', pct(inv.tax_rate),
    money(inv.subtotal), money(inv.sales_tax), money(inv.total), money(inv.payments_credits), money(inv.total - inv.payments_credits),
  ]
  const items = inv.line_items.length ? inv.line_items : [null]
  return items.map((li, idx) =>
    li
      ? [...header, String(idx + 1), str(li.job_code), li.description, str(li.qty), money(li.rate), money(li.amount)]
      : [...header, String(idx + 1), '', '', '', '', ''],
  )
}

/**
 * Fetch the given documents in full and export them as a flattened CSV.
 * `ids` should already be the filtered set the list is showing (§3.1 —
 * "respects active filters").
 */
export async function exportDocuments(module: DocModule, ids: string[], filename: string): Promise<number> {
  let headers: string[] = []
  const rows: string[][] = []

  if (module === 'proposals') {
    headers = PROPOSAL_HEADERS
    const docs = await Promise.all(ids.map((id) => mockGetProposal(id)))
    for (const d of docs) if (d) rows.push(...proposalRows(d))
  } else if (module === 'pos') {
    headers = PO_HEADERS
    const docs = await Promise.all(ids.map((id) => mockGetPO(id)))
    for (const d of docs) if (d) rows.push(...poRows(d))
  } else {
    headers = INVOICE_HEADERS
    const docs = await Promise.all(ids.map((id) => mockGetInvoice(id)))
    for (const d of docs) if (d) rows.push(...invoiceRows(d))
  }

  triggerDownload(toCSV(headers, rows), filename)
  return rows.length
}
