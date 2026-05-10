import type { MPDestination } from '../types/proposal'

export const MOCK_MP_DESTINATIONS: MPDestination[] = [
  {
    id: 'd1',
    final_destination: 'Memorial Hermann Hospital',
    physical_address: '6411 Fannin St, Houston, TX 77030',
    city: 'Houston',
    state: 'TX',
  },
  {
    id: 'd2',
    final_destination: 'MD Anderson Cancer Center',
    physical_address: '1515 Holcombe Blvd, Houston, TX 77030',
    city: 'Houston',
    state: 'TX',
  },
  {
    id: 'd3',
    final_destination: 'UT Southwestern Medical Center',
    physical_address: '5323 Harry Hines Blvd, Dallas, TX 75390',
    city: 'Dallas',
    state: 'TX',
  },
  {
    id: 'd4',
    final_destination: 'Baylor Scott & White Medical Center',
    physical_address: '2401 S 31st St, Temple, TX 76508',
    city: 'Temple',
    state: 'TX',
  },
  {
    id: 'd5',
    final_destination: "Texas Children's Hospital",
    physical_address: '6621 Fannin St, Houston, TX 77030',
    city: 'Houston',
    state: 'TX',
  },
]

export function mockGetMPDestinations(): Promise<MPDestination[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_MP_DESTINATIONS), 150))
}
