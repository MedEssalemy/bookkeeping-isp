import type { ClientContact } from './proposal'

// ── Document direction ────────────────────────────────────────────────────────
// One field drives which side of the business a document belongs to (spec §0.1).
//   Proposal: issued = clients side, received = contractors side
//   Purchase Order: issued = contractors side, received = clients side
//   Invoice: issued = clients side, received = contractors side
// Locked after first save (same rule as proposal Type).
export type DocDirection = 'issued' | 'received'

// ── Attachments (received documents only, followup §4) ────────────────────────
// The counterparty's original file (PDF/docx/etc.) on a received proposal/PO/
// invoice. Issued documents don't carry attachments — their file is the one we
// generate. Frontend v1 is mock-persistence (object URLs, lost on refresh).
export interface Attachment {
  id: string
  file_name: string
  size_bytes: number
  mime_type: string
  uploaded_at: string
}

// ── Contractor (subcontractor) ────────────────────────────────────────────────
// Per the backend ERD, SUBCONTRACTOR is a separate entity from CLIENT, but the
// legacy Outside Expenses tool reuses the client table structure verbatim — so
// the frontend models a Contractor with the exact ClientContact shape (spec
// §3.4). Contractor-side counterparty comboboxes source from contractors;
// client-side ones keep sourcing from clients.
export type Contractor = ClientContact
