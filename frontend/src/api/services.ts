import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { Service, ServiceIn, ServiceList, ServiceUpdateIn } from './types'

export function useServicesQuery() {
  return useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => apiRequest<Service[]>('/services'),
  })
}

/** Every service, active or not (admin only). */
export function useAdminServicesQuery(params: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: ['services', 'admin', params],
    queryFn: () => apiRequest<ServiceList>('/admin/services', { query: { limit: params.limit, offset: params.offset } }),
    placeholderData: keepPreviousData,
  })
}

function invalidateCatalog(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['services'] }),
    client.invalidateQueries({ queryKey: ['providers'] }),
    client.invalidateQueries({ queryKey: ['provider-services'] }),
  ]).then(() => undefined)
}

export function useCreateServiceMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: ServiceIn) => apiRequest<Service>('/services', { method: 'POST', body: data }),
    onSuccess: () => invalidateCatalog(client),
  })
}

export function useUpdateServiceMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceUpdateIn }) =>
      apiRequest<Service>(`/services/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidateCatalog(client),
  })
}

export function useDeactivateServiceMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (service: Service) => apiRequest<void>(`/services/${service.id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateCatalog(client),
  })
}
