// Clients CSV/XLSX round-trip. The implementation now lives in the generalized
// party IO factory (spec followup §1) so Clients and Contractors share one code
// path; this module is a thin client-bound instance kept for import stability.
import { createPartyIO, type ParseResult } from '../../utils/partyIO'

const clientsPartyIO = createPartyIO({ nameHeader: 'Client Name', sheetName: 'Clients' })

export const contactsToCSV = clientsPartyIO.contactsToCSV
export const exportContactsAsCSV = clientsPartyIO.exportContactsAsCSV
export const exportContactsAsXLSX = clientsPartyIO.exportContactsAsXLSX
/** Parse a clients CSV/XLSX file into normalized rows. */
export const parseClientsFile = clientsPartyIO.parseFile

export type { ParseResult }
