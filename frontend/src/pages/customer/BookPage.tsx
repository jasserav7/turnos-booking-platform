import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { useCreateBookingMutation } from '../../api/bookings'
import { useProvidersQuery, useSlotsQuery } from '../../api/providers'
import { useServicesQuery } from '../../api/services'
import type { Booking, Provider, Service } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
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
  `w-full rounded-lg border p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
    selected ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-gray-200 bg-white hover:border-indigo-300'
  }`

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="mb-4 flex items-center gap-3 text-lg font-semibold text-gray-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm text-white" aria-hidden="true">
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
            <span className="block font-medium text-gray-900">{service.name}</span>
            {service.description && <span className="mt-1 block text-sm text-gray-600">{service.description}</span>}
            <span className="mt-2 block text-sm text-gray-500">
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
            <span className="font-medium text-gray-900">{provider.full_name}</span>
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
          <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700">
            Día
          </label>
          <input
            id="booking-date"
            type="date"
            min={minDate}
            value={date}
            onChange={(event) => event.target.value && onDateChange(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <Button variant="secondary" block={false} disabled={date <= minDate} onClick={() => onDateChange(addDays(date, -1))} aria-label="Día anterior">
          ←
        </Button>
        <Button variant="secondary" block={false} onClick={() => onDateChange(addDays(date, 1))} aria-label="Día siguiente">
          →
        </Button>
      </div>
      <p className="text-sm font-medium text-gray-700">{formatDayLong(date)}</p>
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
                className={`w-full rounded-md border px-2 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  selected === slot ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-400'
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
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="font-medium text-gray-900">{service.name}</p>
          <p className="text-gray-600">{formatDateTime(created.starts_at)}</p>
          <p className="text-gray-600">Con {provider.full_name}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/bookings" className="rounded-md bg-indigo-600 px-4 py-2 text-center font-medium text-white hover:bg-indigo-700">
            Ver mis reservas
          </Link>
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
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">Servicio</dt>
                  <dd className="font-medium text-gray-900">
                    {service.name} · {formatPrice(service.price_cents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Profesional</dt>
                  <dd className="font-medium text-gray-900">{provider.full_name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Fecha y hora</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(slot)}</dd>
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
