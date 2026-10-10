import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCreateBookingMutation } from '../../api/bookings'
import { useProvidersQuery, useSlotsQuery } from '../../api/providers'
import { useServicesQuery } from '../../api/services'
import type { Booking, Provider, Service } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Icon } from '../../components/Icon'
import { Button, ButtonLink } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { TextAreaField } from '../../components/TextAreaField'
import { addDays, formatDateTime, formatDayLong, formatTime, today } from '../../lib/dates'
import { errorMessage, isApiError } from '../../lib/errors'
import { formatPrice } from '../../lib/format'

const notesSchema = z.object({
  notes: z.string().max(1000, 'Las notas no pueden superar 1000 caracteres.'),
})
type NotesForm = z.infer<typeof notesSchema>

const optionClass = (selected: boolean) =>
  `w-full rounded-lg border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
    selected ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-accent'
  }`

/** Brings a newly revealed step into view when it appears below the fold (mostly on phones). */
function useRevealOnMount<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!enabled || !node) return
    if (node.getBoundingClientRect().top < window.innerHeight * 0.75) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [enabled])
  return ref
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  const ref = useRevealOnMount<HTMLElement>(number > 1)
  return (
    <section ref={ref} className="scroll-mt-20 rounded-xl bg-surface p-4 ring-1 ring-line sm:p-6" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="mb-4 flex items-center gap-3 text-lg font-semibold tracking-tight text-ink">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm tabular-nums text-on-accent" aria-hidden="true">
          {number}
        </span>
        <span>
          <span className="sr-only">Paso {number}: </span>
          {title}
        </span>
      </h2>
      {children}
    </section>
  )
}

function ServiceStep({ selected, onSelect }: { selected: Service | null; onSelect: (s: Service) => void }) {
  const query = useServicesQuery()
  if (query.isPending) return <LoadingState label="Cargando servicios…" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (query.data.length === 0) return <EmptyState title="No hay servicios disponibles">Vuelve a intentarlo más tarde.</EmptyState>
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {query.data.map((service) => (
        <li key={service.id}>
          <button type="button" aria-pressed={selected?.id === service.id} className={optionClass(selected?.id === service.id)} onClick={() => onSelect(service)}>
            <span className="block font-medium text-ink">{service.name}</span>
            {service.description && <span className="mt-1 block text-sm text-ink-muted">{service.description}</span>}
            <span className="mt-2 block text-sm text-ink-subtle">
              {service.duration_minutes} min · {formatPrice(service.price_cents)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ProviderStep({
  service,
  selected,
  onSelect,
}: {
  service: Service
  selected: Provider | null
  onSelect: (p: Provider) => void
}) {
  const query = useProvidersQuery(service.id)
  if (query.isPending) return <LoadingState label="Cargando profesionales…" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (query.data.length === 0) {
    return <EmptyState title="Ningún profesional ofrece este servicio por ahora">Elige otro servicio.</EmptyState>
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.map((provider) => (
        <li key={provider.id}>
          <button type="button" aria-pressed={selected?.id === provider.id} className={optionClass(selected?.id === provider.id)} onClick={() => onSelect(provider)}>
            <span className="font-medium text-ink">{provider.full_name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function SlotStep({
  service,
  provider,
  date,
  onDateChange,
  selected,
  onSelect,
}: {
  service: Service
  provider: Provider
  date: string
  onDateChange: (date: string) => void
  selected: string | null
  onSelect: (slot: string) => void
}) {
  const minDate = today()
  const query = useSlotsQuery({ providerId: provider.id, serviceId: service.id, date })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="booking-date" className="block text-sm font-medium text-ink">
            Día
          </label>
          <input
            id="booking-date"
            type="date"
            min={minDate}
            value={date}
            onChange={(event) => event.target.value && onDateChange(event.target.value)}
            className="rounded-md border border-line-strong px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>
        <Button variant="secondary" block={false} disabled={date <= minDate} onClick={() => onDateChange(addDays(date, -1))} aria-label="Día anterior">
          <Icon name="chevron-left" />
        </Button>
        <Button variant="secondary" block={false} onClick={() => onDateChange(addDays(date, 1))} aria-label="Día siguiente">
          <Icon name="chevron-right" />
        </Button>
      </div>
      <p className="text-sm font-medium text-ink-muted">{formatDayLong(date)}</p>
      {query.isPending && <LoadingState label="Buscando horarios…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && query.data.length === 0 && (
        <EmptyState title="No hay horarios libres este día">Prueba con otro día.</EmptyState>
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8" aria-label="Horarios disponibles">
          {query.data.map((slot) => (
            <li key={slot}>
              <button
                type="button"
                aria-pressed={selected === slot}
                onClick={() => onSelect(slot)}
                className={`min-h-11 w-full rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition-[border-color,background-color,color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  selected === slot ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-ink hover:border-accent'
                }`}
              >
                {formatTime(slot)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function BookPage() {
  const [service, setService] = useState<Service | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [date, setDate] = useState(today)
  const [slot, setSlot] = useState<string | null>(null)
  const [created, setCreated] = useState<Booking | null>(null)
  const [conflict, setConflict] = useState(false)
  const mutation = useCreateBookingMutation()
  const form = useForm<NotesForm>({ resolver: zodResolver(notesSchema), defaultValues: { notes: '' } })

  function reset() {
    setService(null)
    setProvider(null)
    setSlot(null)
    setCreated(null)
    setConflict(false)
    form.reset()
    mutation.reset()
  }

  function onSubmit({ notes }: NotesForm) {
    if (!service || !provider || !slot) return
    setConflict(false)
    mutation.mutate(
      { service_id: service.id, provider_id: provider.id, starts_at: slot, notes: notes.trim() || null },
      {
        onSuccess: setCreated,
        onError: (error) => {
          if (isApiError(error, 'slot_unavailable')) {
            // The slots query is invalidated by the mutation, so the list reloads.
            setSlot(null)
            setConflict(true)
          }
        },
      },
    )
  }

  if (created && service && provider) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Alert variant="success">
          ¡Reserva creada! Quedó <strong>pendiente</strong> hasta que {provider.full_name} la confirme. Te enviamos un correo con los
          detalles.
        </Alert>
        <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
          <p className="font-medium text-ink">{service.name}</p>
          <p className="text-ink-muted">{formatDateTime(created.starts_at)}</p>
          <p className="text-ink-muted">Con {provider.full_name}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink to="/bookings">Ver mis reservas</ButtonLink>
          <Button variant="secondary" block={false} onClick={reset}>
            Hacer otra reserva
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Reservar una cita" description="Elige el servicio, el profesional y el horario que prefieras." />
      <div className="space-y-6">
        <Step number={1} title="Elige el servicio">
          <ServiceStep
            selected={service}
            onSelect={(next) => {
              setService(next)
              setProvider(null)
              setSlot(null)
            }}
          />
        </Step>

        {service && (
          <Step number={2} title="Elige el profesional">
            <ProviderStep
              service={service}
              selected={provider}
              onSelect={(next) => {
                setProvider(next)
                setSlot(null)
              }}
            />
          </Step>
        )}

        {service && provider && (
          <Step number={3} title="Elige día y hora">
            {conflict && (
              <div className="mb-4">
                <Alert variant="error">{errorMessage(mutation.error)}</Alert>
              </div>
            )}
            <SlotStep
              service={service}
              provider={provider}
              date={date}
              onDateChange={(next) => {
                setDate(next)
                setSlot(null)
              }}
              selected={slot}
              onSelect={(next) => {
                setSlot(next)
                setConflict(false)
              }}
            />
          </Step>
        )}

        {service && provider && slot && (
          <Step number={4} title="Confirma tu reserva">
            <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
              <dl className="grid gap-4 rounded-lg bg-sunken p-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-ink-subtle">Servicio</dt>
                  <dd className="mt-0.5 font-medium text-ink">{service.name}</dd>
                  <dd className="tabular-nums text-ink-muted">
                    {service.duration_minutes} min · {formatPrice(service.price_cents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Profesional</dt>
                  <dd className="mt-0.5 font-medium text-ink">{provider.full_name}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Fecha y hora</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">{formatDateTime(slot)}</dd>
                  <dd className="tabular-nums text-ink-muted">
                    Termina a las {formatTime(new Date(new Date(slot).getTime() + service.duration_minutes * 60_000).toISOString())}
                  </dd>
                </div>
              </dl>
              <TextAreaField
                label="Notas para el profesional (opcional)"
                maxLength={1000}
                error={form.formState.errors.notes?.message}
                {...form.register('notes')}
              />
              {mutation.isError && !conflict && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
              <Button type="submit" loading={mutation.isPending} className="sm:w-auto">
                {mutation.isPending ? 'Reservando…' : 'Confirmar reserva'}
              </Button>
            </form>
          </Step>
        )}
      </div>
    </div>
  )
}
