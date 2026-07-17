import * as XLSX from 'xlsx'
import type { ClientContact } from '../types/proposal'
import type { AddContactInput } from '../api/clients'

/**
 * Generalized CSV/XLSX round-trip for "party" entities that share the
 * `ClientContact` shape — Clients and Contractors (spec followup §1). The only
 * difference between the two is the name-column header label and the sheet name;
 * everything else (column schema, aliasing, parsing) is identical, so both
 * consumers share this one implementation.
 *
 * `createPartyIO({ nameHeader, sheetName })` returns the bound export/parse
 * helpers. `clientsIO.ts` and `contractorsIO` are thin instances of it.
 */

export type { AddContactInput }

const STATE_ABBR: Record<string, string> = {
  California: 'CA', Texas: 'TX', 'New York': 'NY', Nevada: 'NV',
}

function composeFullAddress(c: ClientContact): string {
  if (c.address_full) return c.address_full
  const state = c.state ? (STATE_ABBR[c.state.trim()] ?? c.state.trim()) : ''
  const cityZip = [c.city, [state, c.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [c.address, cityZip].filter(Boolean).join(', ')
}

interface ColumnDef {
  header: string
  aliases?: string[]
  get: (c: ClientContact) => string
  set: (c: AddContactInput, v: string) => void
}

export interface ParseResult {
  rows: AddContactInput[]
  sourceHeaders: string[]
  recognizedHeaders: string[]
  ignoredHeaders: string[]
  missingHeaders: string[]
}

export interface PartyIO {
  headers: string[]
  contactsToCSV: (contacts: ClientContact[]) => string
  exportContactsAsCSV: (contacts: ClientContact[], filename: string) => void
  exportContactsAsXLSX: (contacts: ClientContact[], filename: string) => void
  parseFile: (file: File) => Promise<ParseResult>
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, ' ')
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

/**
 * @param nameHeader canonical header for the person-name column ("Client Name"
 *                   or "Contractor Name").
 * @param sheetName  XLSX worksheet name.
 */
export function createPartyIO(opts: { nameHeader: string; sheetName: string }): PartyIO {
  const COLUMNS: ColumnDef[] = [
    { header: 'Business Name', get: (c) => c.business_name ?? '', set: (c, v) => (c.business_name = v) },
    { header: 'Facility', get: (c) => c.facility ?? '', set: (c, v) => (c.facility = v) },
    { header: 'Department', get: (c) => c.department ?? '', set: (c, v) => (c.department = v) },
    { header: 'Title', get: (c) => c.title ?? '', set: (c, v) => (c.title = v) },
    {
      header: opts.nameHeader,
      aliases: ['Name', 'Contact Name', 'Client Name', 'Contractor Name'],
      get: (c) => c.name ?? '',
      set: (c, v) => (c.name = v),
    },
    { header: 'Phone', get: (c) => c.phone ?? '', set: (c, v) => (c.phone = v) },
    { header: 'Email', get: (c) => c.email ?? '', set: (c, v) => (c.email = v) },
    { header: 'Street Address', aliases: ['Street', 'Address Line 1'], get: (c) => c.address ?? '', set: (c, v) => (c.address = v) },
    { header: 'City', get: (c) => c.city ?? '', set: (c, v) => (c.city = v) },
    { header: 'County', get: (c) => c.county ?? '', set: (c, v) => (c.county = v) },
    { header: 'State', get: (c) => c.state ?? '', set: (c, v) => (c.state = v) },
    { header: 'Zip', aliases: ['Zip Code', 'Postal Code'], get: (c) => c.zip ?? '', set: (c, v) => (c.zip = v) },
    { header: 'Address', aliases: ['Full Address'], get: (c) => composeFullAddress(c), set: () => { /* derived — ignore on import */ } },
  ]
  const HEADERS = COLUMNS.map((c) => c.header)

  function matchColumn(header: string): ColumnDef | null {
    const norm = normalizeHeader(header)
    for (const col of COLUMNS) {
      if (normalizeHeader(col.header) === norm) return col
      if (col.aliases?.some((a) => normalizeHeader(a) === norm)) return col
    }
    return null
  }

  function contactsToCSV(contacts: ClientContact[]): string {
    const lines: string[] = []
    lines.push(HEADERS.map(escapeCell).join(','))
    for (const c of contacts) lines.push(COLUMNS.map((col) => escapeCell(col.get(c))).join(','))
    return lines.join('\r\n')
  }

  function exportContactsAsCSV(contacts: ClientContact[], filename: string): void {
    const blob = new Blob(['﻿', contactsToCSV(contacts)], { type: 'text/csv;charset=utf-8' })
    triggerDownload(blob, filename)
  }

  function exportContactsAsXLSX(contacts: ClientContact[], filename: string): void {
    const aoa: string[][] = [HEADERS]
    for (const c of contacts) aoa.push(COLUMNS.map((col) => col.get(c)))
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, opts.sheetName)
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    triggerDownload(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      filename,
    )
  }

  async function parseFile(file: File): Promise<ParseResult> {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false })
    const firstSheetName = wb.SheetNames[0]
    if (!firstSheetName) {
      return { rows: [], sourceHeaders: [], recognizedHeaders: [], ignoredHeaders: [], missingHeaders: HEADERS.slice() }
    }
    const ws = wb.Sheets[firstSheetName]
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '', raw: false })
    if (aoa.length === 0) {
      return { rows: [], sourceHeaders: [], recognizedHeaders: [], ignoredHeaders: [], missingHeaders: HEADERS.slice() }
    }

    const sourceHeaders = aoa[0].map((h) => String(h).trim())
    const columnMap: (ColumnDef | null)[] = sourceHeaders.map(matchColumn)
    const recognizedHeaders: string[] = []
    const ignoredHeaders: string[] = []
    for (let i = 0; i < sourceHeaders.length; i++) {
      const h = sourceHeaders[i]
      if (!h) continue
      if (columnMap[i]) recognizedHeaders.push(h)
      else ignoredHeaders.push(h)
    }
    const recognizedCanonical = new Set(columnMap.filter(Boolean).map((c) => c!.header))
    const missingHeaders = HEADERS.filter((h) => !recognizedCanonical.has(h))

    const rows: AddContactInput[] = []
    for (let r = 1; r < aoa.length; r++) {
      const rowCells = aoa[r]
      if (!rowCells || rowCells.every((c) => String(c).trim() === '')) continue
      const out: AddContactInput = { name: '', address: '' }
      for (let i = 0; i < columnMap.length; i++) {
        const col = columnMap[i]
        if (!col) continue
        const raw = rowCells[i]
        if (raw === undefined || raw === null) continue
        const s = String(raw).trim()
        if (s) col.set(out, s)
      }
      if (!(out.name ?? '').trim() && !(out.business_name ?? '').trim()) continue
      rows.push(out)
    }

    return { rows, sourceHeaders, recognizedHeaders, ignoredHeaders, missingHeaders }
  }

  return { headers: HEADERS, contactsToCSV, exportContactsAsCSV, exportContactsAsXLSX, parseFile }
}

/** Shared instance for the Contractors page (§1). */
export const contractorsIO = createPartyIO({ nameHeader: 'Contractor Name', sheetName: 'Contractors' })
