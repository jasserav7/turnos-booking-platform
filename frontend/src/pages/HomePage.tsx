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
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((service) => (
        <li key={service.id} className="flex flex-col rounded-2xl bg-surface p-5 ring-1 ring-line transition-shadow duration-200 hover:shadow-lift">
          <p className="text-lg font-bold tracking-tight text-ink">{service.name}</p>
          {service.description && <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-muted">{service.description}</p>}
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-muted">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {service.duration_minutes} min
            </span>
            <span className="text-lg font-bold tabular-nums text-accent-ink">{formatPrice(service.price_cents)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

const STEPS = [
  { title: 'Elige el servicio', text: 'Con su duración y precio a la vista.' },
  { title: 'Escoge al profesional', text: 'Solo los que ofrecen ese servicio.' },
  { title: 'Toma un horario libre', text: 'Ves únicamente lo que está disponible.' },
]

function HowItWorks() {
  return (
    <ol className="relative space-y-6 rounded-3xl bg-accent-soft p-6 sm:p-8" aria-label="Cómo reservar">
      <span className="absolute bottom-14 left-[2.4rem] top-14 w-px bg-accent/30 sm:left-[3.15rem]" aria-hidden="true" />
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative flex gap-4">
          <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold tabular-nums text-on-accent shadow-card">
            {index + 1}
          </span>
          <div className="pt-0.5">
            <p className="font-bold text-accent-soft-ink">{step.title}</p>
            <p className="text-sm text-accent-soft-ink/80">{step.text}</p>
          </div>
        </li>
      ))}
      <li className="relative flex gap-4">
        <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent-ink ring-1 ring-accent/40">
          <Icon name="check" className="h-4 w-4" />
        </span>
        <p className="pt-1.5 text-sm font-semibold text-accent-soft-ink">Recibes la confirmación por correo.</p>
      </li>
    </ol>
  )
}

export default function HomePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="space-y-16">
        <section className="grid items-center gap-10 pt-2 sm:pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Reserva tu cita en minutos
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
              Elige el servicio, el profesional y el horario que mejor te quede. Sin llamadas ni esperas.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/register" block={false} className="sm:px-6">
                Crear cuenta
              </ButtonLink>
              <ButtonLink to="/login" variant="secondary" block={false} className="sm:px-6">
                Iniciar sesión
              </ButtonLink>
            </div>
          </div>
          <HowItWorks />
        </section>
        <section className="space-y-5">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Servicios</h2>
          <ServicesList />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Hola, {user.full_name}</h1>
        <p className="mt-1 text-ink-muted">Entraste como {ROLE_LABELS[user.role].toLowerCase()}.</p>
        {!user.email_verified_at && (
          <div className="mt-4">
            <Alert>Aún no verificas tu correo. Revisa tu bandeja de entrada.</Alert>
          </div>
        )}
      </section>
      <nav aria-label="Accesos rápidos">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_BY_ROLE[user.role].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex min-h-20 items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line transition-shadow duration-200 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-ink">
                  <Icon name={item.icon ?? 'chevron-right'} className="h-5 w-5" />
                </span>
                <span className="flex-1 font-bold text-ink">{item.label}</span>
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
          <h2 className="text-2xl font-bold tracking-tight text-ink">Servicios disponibles</h2>
          <ServicesList />
        </section>
      )}
    </div>
  )
}
