import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { AvailabilityRule, AvailabilityRuleIn, TimeOff, TimeOffIn } from './types'

export function useAvailabilityQuery() {
  return useQuery({
    queryKey: ['availability'],
    queryFn: () => apiRequest<AvailabilityRule[]>('/providers/me/availability'),
  })
}

export function useSaveAvailabilityMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (rules: AvailabilityRuleIn[]) =>
      apiRequest<AvailabilityRule[]>('/providers/me/availability', { method: 'PUT', body: rules }),
    onSuccess: (rules) => {
      client.setQueryData(['availability'], rules)
      return client.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}

export function useTimeOffQuery() {
  return useQuery({
    queryKey: ['time-off'],
    queryFn: () => apiRequest<TimeOff[]>('/providers/me/time-off'),
  })
}

export function useCreateTimeOffMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: TimeOffIn) =>
      apiRequest<TimeOff>('/providers/me/time-off', { method: 'POST', body: data }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['time-off'] }),
        client.invalidateQueries({ queryKey: ['slots'] }),
      ]),
  })
}

export function useDeleteTimeOffMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/providers/me/time-off/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['time-off'] }),
        client.invalidateQueries({ queryKey: ['slots'] }),
      ]),
  })
}
