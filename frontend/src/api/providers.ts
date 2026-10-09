import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
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

/**
 * The API has no "services of a provider" endpoint, so the map is built by asking,
 * for every active service, which providers offer it.
 */
export function useProviderServiceIds(services: Service[] | undefined) {
  const results = useQueries({
    queries: (services ?? []).map((service) => ({
      queryKey: ['providers', service.id],
      queryFn: () => apiRequest<Provider[]>('/providers', { query: { service_id: service.id } }),
    })),
  })
  const byProvider = new Map<string, string[]>()
  results.forEach((result, index) => {
    const serviceId = services?.[index]?.id
    if (!serviceId) return
    for (const provider of result.data ?? []) {
      byProvider.set(provider.id, [...(byProvider.get(provider.id) ?? []), serviceId])
    }
  })
  return {
    byProvider,
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.error)?.error ?? null,
    refetch: () => Promise.all(results.map((r) => r.refetch())),
  }
}

export function useSetProviderServicesMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ providerId, serviceIds }: { providerId: string; serviceIds: string[] }) =>
      apiRequest<Service[]>(`/admin/providers/${providerId}/services`, {
        method: 'PUT',
        body: { service_ids: serviceIds },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['providers'] }),
  })
}
