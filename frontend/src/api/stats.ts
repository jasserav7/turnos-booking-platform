import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { Stats } from './types'

export function useStatsQuery() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => apiRequest<Stats>('/admin/stats'),
  })
}
