import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { Service } from './types'

export function useServicesQuery() {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest<Service[]>('/services'),
  })
}
