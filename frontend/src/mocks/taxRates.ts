import type { TaxRate } from '../types/proposal'

export const MOCK_TAX_RATES: TaxRate[] = [
  { city: 'Austin', state: 'TX', rate: 0.0825 },
  { city: 'Houston', state: 'TX', rate: 0.0825 },
  { city: 'Dallas', state: 'TX', rate: 0.0825 },
  { city: 'San Antonio', state: 'TX', rate: 0.0825 },
  { city: 'Plano', state: 'TX', rate: 0.0825 },
  { city: 'Fort Worth', state: 'TX', rate: 0.0825 },
  { city: 'El Paso', state: 'TX', rate: 0.0825 },
  // 'Nowhere' intentionally absent → defaults to 0
]

export function mockLookupTaxRate(city: string, state: string): Promise<number> {
  const found = MOCK_TAX_RATES.find(
    (r) => r.city.toLowerCase() === city.toLowerCase() && r.state.toLowerCase() === state.toLowerCase(),
  )
  return new Promise((resolve) => setTimeout(() => resolve(found?.rate ?? 0), 100))
}
