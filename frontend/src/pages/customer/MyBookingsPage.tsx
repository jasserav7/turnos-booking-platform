import { useState } from 'react'
import { Link } from 'react-router'
import { useBookingsQuery } from '../../api/bookings'
import type { Booking, BookingStatus } from '../../api/types'
import { Button } from '../../components/Button'
import { CancelBookingDialog } from '../../components/CancelBookingDialog'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { SelectField } from '../../components/SelectField'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDateTime } from '../../lib/dates'
import { BOOKING_STATUSES, STATUS_LABELS } from '../../lib/format'

const PAGE_SIZE = 10
const statusOptions = [{ value: '', label: 'Todos' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]

export default function MyBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [offset, setOffset] = useState(0)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const query = useBookingsQuery({ status: status || undefined, limit: PAGE_SIZE, offset })

  return (
    <div>
      <PageHeader
        title="Mis reservas"
        actions={
          <Link to="/book" className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
            Nueva reserva
          </Link>
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

      {query.isPending && <LoadingState label="Cargando reservas…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && query.data.items.length === 0 && (
        <EmptyState title={status ? `No tienes reservas en estado “${STATUS_LABELS[status]}”` : 'Aún no tienes reservas'}>
          <Link to="/book" className="font-medium text-indigo-600 hover:underline">
            Reserva tu primera cita
          </Link>
        </EmptyState>
      )}
      {query.isSuccess && query.data.items.length > 0 && (
        <>
          <ul className="space-y-3" aria-busy={query.isFetching}>
            {query.data.items.map((booking) => (
              <li key={booking.id} className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{booking.service_name}</p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="text-sm text-gray-600">
                    {formatDateTime(booking.starts_at)} · con {booking.provider_name}
                  </p>
                  {booking.cancel_reason && <p className="text-sm text-gray-500">Motivo de cancelación: {booking.cancel_reason}</p>}
                </div>
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <Button variant="secondary" size="sm" block={false} onClick={() => setCancelling(booking)}>
                    Cancelar
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination total={query.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}

      <CancelBookingDialog
        booking={cancelling}
        description="Recuerda que solo puedes cancelar con la antelación mínima permitida."
        onClose={() => setCancelling(null)}
      />
    </div>
  )
}
