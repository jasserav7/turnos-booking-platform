import { Link } from 'react-router'
import { useServicesQuery } from '../api/services'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { ButtonLink } from '../components/Button'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/QueryStates'
import { formatPrice } from '../lib/format'
import { NAV_BY_ROLE, ROLE_LABELS } from '../lib/navigation'

function ServicesList() {
  const { data, isPending, isError, error, refetch } = useServicesQuery()

  if (isPending) return <LoadingState label="Cargando servicios…" />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (data.length === 0) {
    return <EmptyState title="Todavía no hay servicios disponibles">Vuelve pronto: el catálogo se está preparando.</EmptyState>
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      {data.map((service) => (
        <li key={service.id} className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:px-5">
          <div className="min-w-0">
            <p className="font-medium text-ink">{service.name}</p>
            {service.description && <p className="mt-0.5 max-w-prose text-sm text-ink-muted">{service.description}</p>}
          </div>
          <p className="shrink-0 text-sm tabular-nums text-ink-subtle">
            {service.duration_minutes} min · <span className="font-medium text-ink">{formatPrice(service.price_cents)}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

export default function HomePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="space-y-12">
        <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Reserva tu cita en minutos</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-ink-muted">
            Elige el servicio, el profesional y el horario que mejor te quede.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink to="/register">Crear cuenta</ButtonLink>
            <ButtonLink to="/login" variant="secondary">
              Iniciar sesión
            </ButtonLink>
          </div>
        </section>
        <section className="mx-auto max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Servicios</h2>
          <ServicesList />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Hola, {user.full_name}</h1>
        <p className="mt-1 text-ink-muted">Entraste como {ROLE_LABELS[user.role].toLowerCase()}.</p>
        {!user.email_verified_at && (
          <div className="mt-4">
            <Alert>Aún no verificas tu correo. Revisa tu bandeja de entrada.</Alert>
          </div>
        )}
      </section>
      <nav aria-label="Accesos rápidos">
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line sm:max-w-md">
          {NAV_BY_ROLE[user.role].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex min-h-12 items-center justify-between px-4 font-medium text-ink transition-colors duration-150 hover:bg-sunken focus:outline-none focus-visible:bg-sunken focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
              >
                {item.label}
                <Icon
                  name="chevron-right"
                  className="h-5 w-5 text-ink-subtle transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {user.role === 'customer' && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Servicios disponibles</h2>
          <ServicesList />
        </section>
      )}
    </div>
  )
}
