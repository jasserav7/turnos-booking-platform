import { useState, type ReactNode } from 'react'
import { useStatsQuery } from '../../api/stats'
import type { BookingStatus, Stats } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryStates'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDayLong, formatDayShort } from '../../lib/dates'
import { BOOKING_STATUSES, formatPrice } from '../../lib/format'

const countLabel = (n: number) => `${n} ${n === 1 ? 'reserva' : 'reservas'}`

function StatTile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <div className="text-sm text-gray-600">{children ?? label}</div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  )
}

/** Single series → one hue, no legend; per-bar hover tooltip plus a table view. */
function DailyBars({ days }: { days: Stats['bookings_per_day'] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d.count))
  const active = hovered === null ? null : days[hovered]

  return (
    <figure className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <figcaption className="mb-1 font-medium text-gray-900">Reservas por día · últimos 30 días</figcaption>
      <p className="mb-4 h-5 text-sm text-gray-600" aria-live="polite">
        {active ? `${formatDayLong(active.date)}: ${countLabel(active.count)}` : 'Pasa el cursor sobre una barra para ver el detalle.'}
      </p>
      <div className="flex gap-3">
        <div className="flex h-40 flex-col justify-between text-right text-xs tabular-nums text-gray-500" aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="flex-1">
          <div className="relative flex h-40 items-end gap-[2px] border-b border-gray-300" aria-hidden="true">
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
            {days.map((day, index) => (
              <div
                key={day.date}
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                {day.count > 0 && (
                  <div
                    className={`w-full rounded-t-[4px] ${hovered === index ? 'bg-indigo-800' : 'bg-indigo-600'}`}
                    style={{ height: `${(day.count / max) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500" aria-hidden="true">
            <span>{formatDayShort(days[0].date)}</span>
            <span>{formatDayShort(days[Math.floor(days.length / 2)].date)}</span>
            <span>{formatDayShort(days[days.length - 1].date)}</span>
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          Ver como tabla
        </summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-gray-600">
            <tr>
              <th scope="col" className="py-1 font-medium">Día</th>
              <th scope="col" className="py-1 text-right font-medium">Reservas</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-t border-gray-100">
                <td className="py-1 text-gray-700">{formatDayLong(day.date)}</td>
                <td className="py-1 text-right tabular-nums text-gray-900">{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function TopServices({ services }: { services: Stats['top_services'] }) {
  const max = Math.max(1, ...services.map((s) => s.count))
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200" aria-labelledby="top-services">
      <h2 id="top-services" className="mb-4 font-medium text-gray-900">
        Servicios más reservados
      </h2>
      {services.length === 0 ? (
        <p className="text-sm text-gray-600">Todavía no hay reservas.</p>
      ) : (
        <ol className="space-y-3">
          {services.map((service) => (
            <li key={service.service_id}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="text-gray-900">{service.name}</span>
                <span className="tabular-nums text-gray-600">{countLabel(service.count)}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100" aria-hidden="true">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(service.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function AdminStatsPage() {
  const query = useStatsQuery()

  return (
    <div>
      <PageHeader title="Estadísticas" />
      {query.isPending && <LoadingState label="Cargando estadísticas…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && (() => {
        const stats = query.data
        const count = (status: BookingStatus) => stats.by_status[status] ?? 0
        const total = BOOKING_STATUSES.reduce((sum, status) => sum + count(status), 0)
        if (total === 0) {
          return <EmptyState title="Aún no hay reservas">Las estadísticas aparecerán cuando los clientes empiecen a reservar.</EmptyState>
        }
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              <StatTile label="Reservas totales" value={String(total)} />
              {BOOKING_STATUSES.map((status) => (
                <StatTile key={status} label={status} value={String(count(status))}>
                  <StatusBadge status={status} />
                </StatTile>
              ))}
              <StatTile label="Ingresos estimados" value={formatPrice(stats.estimated_revenue_cents)} />
            </div>
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <DailyBars days={stats.bookings_per_day} />
              <TopServices services={stats.top_services} />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
