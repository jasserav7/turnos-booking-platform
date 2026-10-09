import { useState } from 'react'
import { useProviderServiceIds, useSetProviderServicesMutation } from '../../api/providers'
import { useServicesQuery } from '../../api/services'
import type { Service, User } from '../../api/types'
import { useAdminUsersQuery } from '../../api/users'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { errorMessage } from '../../lib/errors'

function ProviderCard({ provider, services, initial }: { provider: User; services: Service[]; initial: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial))
  const mutation = useSetProviderServicesMutation()
  const dirty = selected.size !== initial.length || initial.some((id) => !selected.has(id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <li className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <fieldset>
        <legend className="mb-1 font-medium text-gray-900">
          {provider.full_name}
          {!provider.is_active && <span className="ml-2 text-xs font-normal text-gray-500">(inactivo)</span>}
        </legend>
        <p className="mb-3 text-sm text-gray-500">{provider.email}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((service) => (
            <label key={service.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.has(service.id)}
                onChange={() => toggle(service.id)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
              />
              {service.name}
            </label>
          ))}
        </div>
      </fieldset>
      {mutation.isError && (
        <div className="mt-3">
          <Alert variant="error">{errorMessage(mutation.error)}</Alert>
        </div>
      )}
      {mutation.isSuccess && !dirty && <p className="mt-3 text-sm text-green-700">Servicios guardados.</p>}
      <div className="mt-4">
        <Button
          size="sm"
          block={false}
          disabled={!dirty}
          loading={mutation.isPending}
          onClick={() => mutation.mutate({ providerId: provider.id, serviceIds: [...selected] })}
          aria-label={`Guardar servicios de ${provider.full_name}`}
        >
          Guardar
        </Button>
      </div>
    </li>
  )
}

export default function AdminProvidersPage() {
  const providers = useAdminUsersQuery({ role: 'provider', limit: 100 })
  const services = useServicesQuery()
  const assignments = useProviderServiceIds(services.data)
  const pending = providers.isPending || services.isPending || assignments.isPending
  const error = providers.error ?? services.error ?? assignments.error

  return (
    <div>
      <PageHeader
        title="Profesionales"
        description="Elige qué servicios ofrece cada profesional. Para crear un profesional, cambia el rol de un usuario en “Usuarios”."
      />
      {error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void providers.refetch()
            void services.refetch()
            void assignments.refetch()
          }}
        />
      ) : pending ? (
        <LoadingState label="Cargando profesionales…" />
      ) : providers.data?.items.length === 0 ? (
        <EmptyState title="Aún no hay profesionales">Asigna el rol “Profesional” a un usuario desde la sección Usuarios.</EmptyState>
      ) : services.data?.length === 0 ? (
        <EmptyState title="No hay servicios activos">Crea servicios antes de asignarlos.</EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {providers.data?.items.map((provider) => {
            const initial = assignments.byProvider.get(provider.id) ?? []
            return (
              <ProviderCard
                key={`${provider.id}:${[...initial].sort().join(',')}`}
                provider={provider}
                services={services.data ?? []}
                initial={initial}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
