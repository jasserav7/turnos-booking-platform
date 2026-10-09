import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { Provider, Service } from './types'

export function useProvidersQuery(serviceId?: string) {
  return useQuery({
    queryKey: ['providers', serviceId ?? 'all'],
    queryFn: () => apiRequest<Provider[]>('/providers', { query: { service_id: serviceId } }),
  })
}

export function useSlotsQuery(params: {
  providerId: string | null
  serviceId: string | null
  date: string | null
}) {
  const { providerId, serviceId, date } = params
  return useQuery({
    queryKey: ['slots', providerId, serviceId, date],
    queryFn: () =>
      apiRequest<string[]>(`/providers/${providerId}/slots`, {
        query: { service_id: serviceId, date_from: date, date_to: date },
      }),
    enabled: Boolean(providerId && serviceId && date),
    staleTime: 0,
  })
}

/** Services assigned to a provider, active or not (admin only). */
export function useProviderServicesQuery(providerId: string) {
  return useQuery({
    queryKey: ['provider-services', providerId],
    queryFn: () => apiRequest<Service[]>(`/admin/providers/${providerId}/services`),
  })
}

export function useSetProviderServicesMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ providerId, serviceIds }: { providerId: string; serviceIds: string[] }) =>
      apiRequest<Service[]>(`/admin/providers/${providerId}/services`, {
        method: 'PUT',
        body: { service_ids: serviceIds },
      }),
    onSuccess: (services, { providerId }) => {
      client.setQueryData(['provider-services', providerId], services)
      return client.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}
