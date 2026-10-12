import { useState } from 'react'
import { Link } from 'react-router'
import { useBookingsQuery, useDownloadCalendarMutation } from '../../api/bookings'
import type { Booking, BookingStatus } from '../../api/types'
import { Button, ButtonLink } from '../../components/Button'
import { CancelBookingDialog } from '../../components/CancelBookingDialog'
import { Alert } from '../../components/Alert'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { RescheduleDialog } from '../../components/RescheduleDialog'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { SelectField } from '../../components/SelectField'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDateTime } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { BOOKING_STATUSES, STATUS_LABELS } from '../../lib/format'

const PAGE_SIZE = 10
const statusOptions = [{ value: '', label: 'Todos' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]

export default function MyBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [offset, setOffset] = useState(0)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [rescheduling, setRescheduling] = useState<Booking | null>(null)
  const calendar = useDownloadCalendarMutation()
  const query = useBookingsQuery({ status: status || undefined, limit: PAGE_SIZE, offset })

  return (
    <div>
      <PageHeader
        title="Mis reservas"
        actions={
          <ButtonLink to="/book">Nueva reserva</ButtonLink>
        }
      />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Filtrar por estado"
          value={status}
          options={statusOptions}
          onChange={(event) => {
            setStatus(event.target.value as BookingStatus | '')
            setOffset(0)
          }}
        />
      </div>

      {calendar.isError && (
        <div className="mb-4">
          <Alert variant="error">{errorMessage(calendar.error)}</Alert>
        </div>
      )}
      {query.isPending && <LoadingState label="Cargando reservas…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && query.data.items.length === 0 && (
        <EmptyState title={status ? `No tienes reservas en estado “${STATUS_LABELS[status]}”` : 'Aún no tienes reservas'}>
          <Link to="/book" className="font-medium text-accent-ink hover:underline">
            Reserva tu primera cita
          </Link>
        </EmptyState>
      )}
      {query.isSuccess && query.data.items.length > 0 && (
        <>
          <ul className="space-y-3" aria-busy={query.isFetching}>
            {query.data.items.map((booking) => (
              <li key={booking.id} className="flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{booking.service_name}</p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="text-sm text-ink-muted">
                    <span className="tabular-nums">{formatDateTime(booking.starts_at)}</span> · con {booking.provider_name}
                  </p>
                  {booking.cancel_reason && <p className="text-sm text-ink-subtle">Motivo de cancelación: {booking.cancel_reason}</p>}
                </div>
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      block={false}
                      loading={calendar.isPending && calendar.variables === booking.id}
                      onClick={() => calendar.mutate(booking.id)}
                    >
                      <Icon name="calendar" className="h-4 w-4" />
                      Añadir al calendario
                    </Button>
                    <Button variant="secondary" size="sm" block={false} onClick={() => setRescheduling(booking)}>
                      Reprogramar
                    </Button>
                    <Button variant="secondary" size="sm" block={false} onClick={() => setCancelling(booking)}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination total={query.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}

      <RescheduleDialog booking={rescheduling} onClose={() => setRescheduling(null)} />
      <CancelBookingDialog
        booking={cancelling}
        description="Recuerda que solo puedes cancelar con la antelación mínima permitida."
        onClose={() => setCancelling(null)}
      />
    </div>
  )
}
