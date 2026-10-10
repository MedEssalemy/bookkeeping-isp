import { describe, expect, it } from 'vitest'
import { createPartyIO } from './partyIO'
import type { ClientContact } from '../types/proposal'

const io = createPartyIO({ nameHeader: 'Client Name', sheetName: 'Clients' })

const csvFile = (text: string) => new File([text], 'import.csv', { type: 'text/csv' })

describe('contactsToCSV', () => {
  it('escapes commas, quotes and newlines', () => {
    const contact = { name: 'Doe, Jane', business_name: 'The "Best" Clinic', title: 'Line1\nLine2' } as ClientContact
    const [, row] = io.contactsToCSV([contact]).split('\r\n')
    expect(row).toContain('"The ""Best"" Clinic"')
    expect(row).toContain('"Doe, Jane"')
    expect(row).toContain('"Line1\nLine2"')
  })

  it('composes the full address and abbreviates known states', () => {
    const contact = { name: 'A', address: '1 Main St', city: 'Austin', state: 'Texas', zip: '73301' } as ClientContact
    const lines = io.contactsToCSV([contact]).split('\r\n')
    expect(lines[0].split(',').at(-1)).toBe('Address')
    expect(lines[1]).toContain('"1 Main St, Austin, TX 73301"')
  })
})

describe('parseFile', () => {
  it('maps aliased headers and reports ignored and missing ones', async () => {
    const result = await io.parseFile(csvFile('Contact Name,Zip Code,Favourite Color\nJane,90210,blue\n'))
    expect(result.rows).toEqual([{ name: 'Jane', address: '', zip: '90210' }])
    expect(result.recognizedHeaders).toEqual(['Contact Name', 'Zip Code'])
    expect(result.ignoredHeaders).toEqual(['Favourite Color'])
    expect(result.missingHeaders).toContain('Email')
  })

  it('skips blank rows and rows with neither a name nor a business name', async () => {
    const result = await io.parseFile(csvFile('Client Name,Business Name,Phone\n,,555\n,Acme,\n\n'))
    expect(result.rows).toEqual([{ name: '', address: '', business_name: 'Acme' }])
  })
})
