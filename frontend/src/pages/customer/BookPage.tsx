import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCreateBookingMutation } from '../../api/bookings'
import { useProvidersQuery } from '../../api/providers'
import { useServicesQuery } from '../../api/services'
import type { Booking, Provider, Service } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Icon } from '../../components/Icon'
import { Button, ButtonLink } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { SlotPicker } from '../../components/SlotPicker'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { TextAreaField } from '../../components/TextAreaField'
import { formatDateTime, formatTime, today } from '../../lib/dates'
import { errorMessage, isApiError } from '../../lib/errors'
import { formatPrice } from '../../lib/format'

const notesSchema = z.object({
  notes: z.string().max(1000, 'Las notas no pueden superar 1000 caracteres.'),
})
type NotesForm = z.infer<typeof notesSchema>

const optionClass = (selected: boolean) =>
  `relative w-full rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow,translate,scale] duration-200 active:scale-[0.98] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
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
    <section ref={ref} className="scroll-mt-20 rounded-3xl motion-safe:animate-rise bg-surface p-4 ring-1 ring-line sm:p-6" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="mb-4 flex items-center gap-3 text-lg font-bold tracking-tight text-ink">
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

function SelectedMark() {
  return (
    <span
      className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-on-accent motion-safe:animate-pop"
      aria-hidden="true"
    >
      <Icon name="check" className="h-3.5 w-3.5" />
    </span>
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
            {selected?.id === service.id && <SelectedMark />}
            <span className="block pr-8 font-bold text-ink">{service.name}</span>
            {service.description && <span className="mt-1 block text-sm text-ink-muted">{service.description}</span>}
            <span className="mt-3 flex items-center justify-between text-sm tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-ink-subtle">
                <Icon name="clock" className="h-4 w-4" />
                {service.duration_minutes} min
              </span>
              <span className="font-bold text-accent-ink">{formatPrice(service.price_cents)}</span>
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
            {selected?.id === provider.id && <SelectedMark />}
            <span className="block pr-8 font-bold text-ink">{provider.full_name}</span>
          </button>
        </li>
      ))}
    </ul>
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
            <SlotPicker
              serviceId={service.id}
              providerId={provider.id}
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
