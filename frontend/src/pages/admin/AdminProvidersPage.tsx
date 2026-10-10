import { useState } from 'react'
import { useProviderServicesQuery, useSetProviderServicesMutation } from '../../api/providers'
import { useAdminServicesQuery } from '../../api/services'
import type { Service, User } from '../../api/types'
import { useAdminUsersQuery } from '../../api/users'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { errorMessage } from '../../lib/errors'

function AssignmentForm({ provider, services, initial }: { provider: User; services: Service[]; initial: string[] }) {
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
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {services.map((service) => (
          <label key={service.id} className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={selected.has(service.id)}
              onChange={() => toggle(service.id)}
              className="h-4 w-4 rounded border-line-strong text-accent-ink focus:ring-2 focus:ring-focus"
            />
            {service.name}
            {!service.is_active && <span className="text-xs text-ink-subtle">(inactivo)</span>}
          </label>
        ))}
      </div>
      {mutation.isError && (
        <div className="mt-3">
          <Alert variant="error">{errorMessage(mutation.error)}</Alert>
        </div>
      )}
      {mutation.isSuccess && !dirty && <p className="mt-3 text-sm text-success-ink">Servicios guardados.</p>}
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
    </>
  )
}

function ProviderCard({ provider, services }: { provider: User; services: Service[] }) {
  const assigned = useProviderServicesQuery(provider.id)
  const initial = (assigned.data ?? []).map((s) => s.id)

  return (
    <li className="rounded-xl bg-surface p-4 ring-1 ring-line">
      <fieldset>
        <legend className="mb-1 font-semibold text-ink">
          {provider.full_name}
          {!provider.is_active && <span className="ml-2 text-xs font-normal text-ink-subtle">(inactivo)</span>}
        </legend>
        <p className="mb-3 text-sm text-ink-subtle">{provider.email}</p>
        {assigned.isPending && <LoadingState label="Cargando servicios asignados…" />}
        {assigned.isError && <ErrorState error={assigned.error} onRetry={() => void assigned.refetch()} />}
        {assigned.isSuccess && (
          <AssignmentForm key={[...initial].sort().join(',')} provider={provider} services={services} initial={initial} />
        )}
      </fieldset>
    </li>
  )
}

export default function AdminProvidersPage() {
  const providers = useAdminUsersQuery({ role: 'provider', limit: 100 })
  const services = useAdminServicesQuery({ limit: 100 })
  const error = providers.error ?? services.error

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
          }}
        />
      ) : providers.isPending || services.isPending ? (
        <LoadingState label="Cargando profesionales…" />
      ) : providers.data?.items.length === 0 ? (
        <EmptyState title="Aún no hay profesionales">Asigna el rol “Profesional” a un usuario desde la sección Usuarios.</EmptyState>
      ) : services.data?.items.length === 0 ? (
        <EmptyState title="No hay servicios">Crea servicios antes de asignarlos.</EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {providers.data?.items.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} services={services.data?.items ?? []} />
          ))}
        </ul>
      )}
    </div>
  )
}
