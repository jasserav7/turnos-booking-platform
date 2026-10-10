import { useState } from 'react'
import { useBookingActionMutation, useBookingsQuery, type BookingAction } from '../../api/bookings'
import type { Booking } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { CancelBookingDialog } from '../../components/CancelBookingDialog'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { StatusBadge } from '../../components/StatusBadge'
import { addDays, dayOf, formatDayLong, formatDayShort, formatTime, today, weekStart } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'

type Mode = 'day' | 'week'
const MAX_ITEMS = 100

export default function AgendaPage() {
  const [mode, setMode] = useState<Mode>('day')
  const [anchor, setAnchor] = useState(today)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const from = mode === 'day' ? anchor : weekStart(anchor)
  const to = mode === 'day' ? anchor : addDays(from, 6)
  const query = useBookingsQuery({ dateFrom: from, dateTo: to, limit: MAX_ITEMS })
  const action = useBookingActionMutation()
  const step = mode === 'day' ? 1 : 7

  const days = mode === 'day' ? [from] : Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const byDay = new Map<string, Booking[]>()
  for (const booking of query.data?.items ?? []) {
    const day = dayOf(booking.starts_at)
    byDay.set(day, [...(byDay.get(day) ?? []), booking])
  }

  function run(booking: Booking, kind: Exclude<BookingAction, 'cancel'>) {
    action.mutate({ id: booking.id, action: kind })
  }

  const rangeLabel = mode === 'day' ? formatDayLong(from) : `${formatDayShort(from)} – ${formatDayShort(to)}`

  return (
    <div>
      <PageHeader title="Mi agenda" description="Confirma, cancela o completa las reservas de tus clientes." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="Vista">
          {(['day', 'week'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`border px-4 py-2 text-sm font-medium first:rounded-l-md last:rounded-r-md focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                mode === value ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-ink-muted hover:bg-sunken'
              }`}
            >
              {value === 'day' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" block={false} onClick={() => setAnchor(addDays(anchor, -step))} aria-label={mode === 'day' ? 'Día anterior' : 'Semana anterior'}>
            <Icon name="chevron-left" />
          </Button>
          <Button variant="secondary" size="sm" block={false} onClick={() => setAnchor(today())}>
            Hoy
          </Button>
          <Button variant="secondary" size="sm" block={false} onClick={() => setAnchor(addDays(anchor, step))} aria-label={mode === 'day' ? 'Día siguiente' : 'Semana siguiente'}>
            <Icon name="chevron-right" />
          </Button>
          <label className="sr-only" htmlFor="agenda-date">
            Ir a la fecha
          </label>
          <input
            id="agenda-date"
            type="date"
            value={anchor}
            onChange={(event) => event.target.value && setAnchor(event.target.value)}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">{rangeLabel}</h2>
      {action.isError && (
        <div className="mb-4">
          <Alert variant="error">{errorMessage(action.error)}</Alert>
        </div>
      )}
      {query.isPending && <LoadingState label="Cargando agenda…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && query.data.items.length === 0 && (
        <EmptyState title={mode === 'day' ? 'No tienes reservas este día' : 'No tienes reservas esta semana'}>
          Cuando un cliente reserve contigo, la cita aparecerá aquí.
        </EmptyState>
      )}
      {query.isSuccess && query.data.items.length > 0 && (
        <div className="space-y-6" aria-busy={query.isFetching}>
          {query.data.total > query.data.items.length && (
            <Alert>Se muestran las primeras {MAX_ITEMS} reservas del rango. Cambia a la vista por día para ver el resto.</Alert>
          )}
          {days
            .filter((day) => byDay.has(day))
            .map((day) => (
              <section key={day} aria-label={formatDayLong(day)}>
                {mode === 'week' && <h3 className="mb-2 font-medium text-ink-muted">{formatDayLong(day)}</h3>}
                <ul className="space-y-3">
                  {(byDay.get(day) ?? []).map((booking) => {
                    const started = new Date(booking.starts_at) <= new Date()
                    const busy = action.isPending && action.variables?.id === booking.id
                    return (
                      <li key={booking.id} className="flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-line md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-ink">
                              <span className="tabular-nums">
                                {formatTime(booking.starts_at)} – {formatTime(booking.ends_at)}
                              </span>{' '}
                              · {booking.service_name}
                            </p>
                            <StatusBadge status={booking.status} />
                          </div>
                          <p className="text-sm text-ink-muted">{booking.customer_name}</p>
                          {booking.notes && <p className="text-sm text-ink-subtle">Notas: {booking.notes}</p>}
                          {booking.cancel_reason && <p className="text-sm text-ink-subtle">Motivo de cancelación: {booking.cancel_reason}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {booking.status === 'pending' && (
                            <Button size="sm" block={false} loading={busy && action.variables?.action === 'confirm'} disabled={busy} onClick={() => run(booking, 'confirm')}>
                              Confirmar
                            </Button>
                          )}
                          {booking.status === 'confirmed' && (
                            <Button
                              size="sm"
                              block={false}
                              loading={busy && action.variables?.action === 'complete'}
                              disabled={busy || !started}
                              title={started ? undefined : 'Disponible cuando la cita haya empezado'}
                              onClick={() => run(booking, 'complete')}
                            >
                              Completar
                            </Button>
                          )}
                          {(booking.status === 'pending' || booking.status === 'confirmed') && (
                            <Button variant="secondary" size="sm" block={false} disabled={busy} onClick={() => setCancelling(booking)}>
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}

      <CancelBookingDialog booking={cancelling} description="El cliente recibirá un correo avisándole." onClose={() => setCancelling(null)} />
    </div>
  )
}
