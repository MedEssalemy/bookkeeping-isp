import type { ClientContact } from '../../types/proposal'

/**
 * Columns are kept identical to the source spreadsheet ("Clients list.csv")
 * so a round-trip (export → edit → import) produces a stable file.
 */
const COLUMNS: { header: string; get: (c: ClientContact) => string }[] = [
  { header: 'Business Name', get: (c) => c.business_name ?? '' },
  { header: 'Facility',      get: (c) => c.facility ?? '' },
  { header: 'Department',    get: (c) => c.department ?? '' },
  { header: 'Title',         get: (c) => c.title ?? '' },
  { header: 'Client Name',   get: (c) => c.name ?? '' },
  { header: 'Phone',         get: (c) => c.phone ?? '' },
  { header: 'Email',         get: (c) => c.email ?? '' },
  { header: 'Street Address', get: (c) => c.address ?? '' },
  { header: 'City',          get: (c) => c.city ?? '' },
  { header: 'County',        get: (c) => c.county ?? '' },
  { header: 'State',         get: (c) => c.state ?? '' },
  // The original CSV had an extra composite "Address" column. We rebuild it
  // from parts so the export self-heals when source rows have partial data.
  {
    header: 'Address',
    get: (c) => [c.address, [c.city, c.state].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' '),
  },
]

function escapeCell(v: string): string {
  // RFC 4180: quote when the value contains comma, quote, CR, or LF.
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export function contactsToCSV(contacts: ClientContact[]): string {
  const lines: string[] = []
  lines.push(COLUMNS.map((c) => escapeCell(c.header)).join(','))
  for (const c of contacts) {
    lines.push(COLUMNS.map((col) => escapeCell(col.get(c))).join(','))
  }
  // \r\n line endings for maximum compatibility (Excel on Windows).
  return lines.join('\r\n')
}

export function exportContactsAsCSV(contacts: ClientContact[], filename: string): void {
  const csv = contactsToCSV(contacts)
  // Prepend a UTF-8 BOM so Excel detects encoding on Windows.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so some browsers don't cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
