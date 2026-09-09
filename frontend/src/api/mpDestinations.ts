import { useQuery } from '@tanstack/vue-query'
import { useMocks } from '../mocks'
import { mockGetMPDestinations } from '../mocks/mpDestinations'
import { api as axios } from './axios'
import type { MPDestination } from '../types/proposal'

async function getMPDestinations(): Promise<MPDestination[]> {
  if (useMocks) return mockGetMPDestinations()
  return axios.get('/mp-destinations').then((r) => r.data as MPDestination[])
}

export function useMPDestinations() {
  return useQuery({
    queryKey: ['mp-destinations'],
    queryFn: getMPDestinations,
    staleTime: 5 * 60 * 1000,
  })
}
