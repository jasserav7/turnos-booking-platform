import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { Service, ServiceIn, ServiceUpdateIn } from './types'

const DEACTIVATED_KEY = ['services', 'deactivated'] as const

export function useServicesQuery() {
  return useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => apiRequest<Service[]>('/services'),
  })
}

/**
 * GET /services only returns active services, so the ones deactivated during this
 * session are remembered in the cache to allow reactivating them.
 */
export function useDeactivatedServices(): Service[] {
  const { data } = useQuery({
    queryKey: DEACTIVATED_KEY,
    queryFn: () => [] as Service[],
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return data ?? []
}

function rememberDeactivated(client: QueryClient, service: Service): void {
  client.setQueryData<Service[]>(DEACTIVATED_KEY, (prev = []) => [
    ...prev.filter((s) => s.id !== service.id),
    { ...service, is_active: false },
  ])
}

function forgetDeactivated(client: QueryClient, id: string): void {
  client.setQueryData<Service[]>(DEACTIVATED_KEY, (prev = []) => prev.filter((s) => s.id !== id))
}

function invalidateCatalog(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['services', 'active'] }),
    client.invalidateQueries({ queryKey: ['providers'] }),
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
    onSuccess: (service) => {
      if (service.is_active) forgetDeactivated(client, service.id)
      else rememberDeactivated(client, service)
      return invalidateCatalog(client)
    },
  })
}

export function useDeactivateServiceMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (service: Service) =>
      apiRequest<void>(`/services/${service.id}`, { method: 'DELETE' }),
    onSuccess: (_data, service) => {
      rememberDeactivated(client, service)
      return invalidateCatalog(client)
    },
  })
}
