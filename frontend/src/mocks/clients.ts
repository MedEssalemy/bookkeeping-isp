import type { ClientContact } from '../types/proposal'

export const MOCK_CLIENT_CONTACTS: ClientContact[] = [
  // Acme Medical Center — 2 addresses
  {
    name: 'Acme Medical Center',
    address: '100 Main St',
    title: 'Director of Imaging',
    business_name: 'Acme Medical Center',
    department: 'Radiology',
    phone: '(512) 555-0100',
    email: 'imaging@acmemed.example',
    city: 'Austin',
    state: 'TX',
  },
  {
    name: 'Acme Medical Center',
    address: '200 Oak Ave',
    title: 'Facilities Manager',
    business_name: 'Acme Medical Center',
    department: 'Facilities',
    phone: '(713) 555-0101',
    email: 'facilities@acmemed.example',
    city: 'Houston',
    state: 'TX',
  },
  // Beta Radiology Group — single address
  {
    name: 'Beta Radiology Group',
    address: '55 Park Blvd',
    title: 'Lead Tech',
    business_name: 'Beta Radiology Group',
    department: 'Operations',
    phone: '(214) 555-0202',
    email: 'ops@betarad.example',
    city: 'Dallas',
    state: 'TX',
  },
  // Gamma Health Systems — 3 addresses
  {
    name: 'Gamma Health Systems',
    address: '300 Elm Rd',
    title: 'CFO',
    business_name: 'Gamma Health Systems',
    department: 'Finance',
    phone: '(210) 555-0303',
    email: 'cfo@gammahealth.example',
    city: 'San Antonio',
    state: 'TX',
  },
  {
    name: 'Gamma Health Systems',
    address: '400 Pine St',
    title: 'Site Director',
    business_name: 'Gamma Health Systems',
    department: 'Operations',
    phone: '(972) 555-0304',
    email: 'plano@gammahealth.example',
    city: 'Plano',
    state: 'TX',
  },
  {
    name: 'Gamma Health Systems',
    address: '500 Cedar Ln',
    title: 'Operations Lead',
    business_name: 'Gamma Health Systems',
    department: 'Operations',
    phone: '(817) 555-0305',
    email: 'ftworth@gammahealth.example',
    city: 'Fort Worth',
    state: 'TX',
  },
  // Delta Imaging LLC
  {
    name: 'Delta Imaging LLC',
    address: '12 River Dr',
    title: 'Owner',
    business_name: 'Delta Imaging LLC',
    department: '',
    phone: '(915) 555-0404',
    email: 'owner@deltaimg.example',
    city: 'El Paso',
    state: 'TX',
  },
  // No-tax client (city has no tax-rate match)
  {
    name: 'No Tax City Corp',
    address: '1 Blank Ave',
    title: 'Buyer',
    business_name: 'No Tax City Corp',
    department: 'Procurement',
    phone: '(555) 555-0000',
    email: 'buyer@notaxcity.example',
    city: 'Nowhere',
    state: 'TX',
  },
]

function delay<T>(data: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

// Distinct names search — used by the client name combobox
export function mockSearchClientNames(q: string): Promise<string[]> {
  const names = Array.from(new Set(MOCK_CLIENT_CONTACTS.map((c) => c.name)))
  return delay(
    names.filter((n) => n.toLowerCase().includes(q.toLowerCase())),
  )
}

// Lookup contact rows for a given name (1..N)
export function mockClientLookup(name: string): Promise<ClientContact[]> {
  return delay(
    MOCK_CLIENT_CONTACTS.filter((c) => c.name.toLowerCase() === name.toLowerCase()),
  )
}
