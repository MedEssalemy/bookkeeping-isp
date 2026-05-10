import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import { mockLookupTaxRate } from '../mocks/taxRates'
import { api as axios } from './axios'

async function lookupTaxRate(city: string, state: string): Promise<number> {
  if (useMocks) return mockLookupTaxRate(city, state)
  return axios
    .get('/tax-rates/lookup', { params: { city, state } })
    .then((r) => ((r.data as { rate?: number }).rate ?? 0))
    .catch(() => 0)
}

export function useTaxRateLookup(city: Ref<string>, state: Ref<string>) {
  return useQuery({
    queryKey: ['tax-rate', city, state],
    queryFn: () => lookupTaxRate(city.value, state.value),
    enabled: () => !!city.value && !!state.value,
    staleTime: 10 * 60 * 1000,
  })
}
