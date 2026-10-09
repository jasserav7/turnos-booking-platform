import { useState } from 'react'
import { useBookingsQuery } from '../../api/bookings'
import type { BookingStatus } from '../../api/types'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { SelectField } from '../../components/SelectField'
import { StatusBadge } from '../../components/StatusBadge'
import { TextField } from '../../components/TextField'
import { formatDateTime } from '../../lib/dates'
import { BOOKING_STATUSES, STATUS_LABELS } from '../../lib/format'

const PAGE_SIZE = 20
const statusOptions = [{ value: '', label: 'Todos' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]

export default function AdminBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const invalidRange = Boolean(dateFrom && dateTo && dateTo < dateFrom)
  const query = useBookingsQuery({
    status: status || undefined,
    dateFrom: invalidRange ? undefined : dateFrom || undefined,
    dateTo: invalidRange ? undefined : dateTo || undefined,
    limit: PAGE_SIZE,
    offset,
  })
  const filtered = Boolean(status || dateFrom || dateTo)

  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setOffset(0)
    }
  }

  return (
    <div>
      <PageHeader title="Reservas" description="Todas las reservas de la plataforma." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <SelectField label="Estado" value={status} options={statusOptions} onChange={(e) => change((v) => setStatus(v as BookingStatus | ''))(e.target.value)} />
        <TextField type="date" label="Desde" value={dateFrom} onChange={(e) => change(setDateFrom)(e.target.value)} />
        <TextField
          type="date"
          label="Hasta"
          value={dateTo}
          min={dateFrom || undefined}
          error={invalidRange ? 'Debe ser igual o posterior a “Desde”.' : undefined}
          onChange={(e) => change(setDateTo)(e.target.value)}
        />
        {filtered && (
          <Button
            variant="secondary"
            block={false}
            onClick={() => {
              setStatus('')
              setDateFrom('')
              setDateTo('')
              setOffset(0)
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
      {invalidRange && (
        <div className="mb-4">
          <Alert>El filtro de fechas se ignora hasta que el rango sea válido.</Alert>
        </div>
      )}
      {query.isPending && <LoadingState label="Cargando reservas…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && query.data.items.length === 0 && (
        <EmptyState title={filtered ? 'Ninguna reserva coincide con los filtros' : 'Todavía no hay reservas'}>
          {filtered ? 'Prueba con otro estado o rango de fechas.' : 'Aparecerán aquí cuando los clientes reserven.'}
        </EmptyState>
      )}
      {query.isSuccess && query.data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200" aria-busy={query.isFetching}>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
                  <th scope="col" className="px-4 py-3 font-medium">Servicio</th>
                  <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
                  <th scope="col" className="px-4 py-3 font-medium">Profesional</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {query.data.items.map((booking) => (
                  <tr key={booking.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">{formatDateTime(booking.starts_at)}</td>
                    <td className="px-4 py-3 text-gray-700">{booking.service_name}</td>
                    <td className="px-4 py-3 text-gray-700">{booking.customer_name}</td>
                    <td className="px-4 py-3 text-gray-700">{booking.provider_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={query.data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
