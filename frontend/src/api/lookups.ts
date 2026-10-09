import { useMemo } from 'react'
import { useProvidersQuery } from './providers'
import { useDeactivatedServices, useServicesQuery } from './services'
import type { Booking } from './types'
import { useAdminUsersQuery } from './users'

const shortId = (id: string) => id.slice(0, 8)

/**
 * Bookings only carry ids; names are resolved from the catalog (and, for admins,
 * from the first page of customers). Unknown ids fall back to a short id.
 */
export function useBookingNames(options: { withCustomers?: boolean } = {}) {
  const services = useServicesQuery()
  const deactivated = useDeactivatedServices()
  const providers = useProvidersQuery()
  const customers = useAdminUsersQuery({ role: 'customer', limit: 100 }, Boolean(options.withCustomers))

  return useMemo(() => {
    const serviceNames = new Map([...(services.data ?? []), ...deactivated].map((s) => [s.id, s.name]))
    const providerNames = new Map((providers.data ?? []).map((p) => [p.id, p.full_name]))
    const customerNames = new Map((customers.data?.items ?? []).map((u) => [u.id, u.full_name]))
    return {
      service: (b: Booking) => serviceNames.get(b.service_id) ?? 'Servicio no disponible',
      provider: (b: Booking) => providerNames.get(b.provider_id) ?? `Profesional ${shortId(b.provider_id)}`,
      customer: (b: Booking) => customerNames.get(b.customer_id) ?? `Cliente ${shortId(b.customer_id)}`,
    }
  }, [services.data, deactivated, providers.data, customers.data])
}
