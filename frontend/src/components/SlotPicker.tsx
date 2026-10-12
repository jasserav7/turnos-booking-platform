import { useId } from 'react'
import { useSlotsQuery } from '../api/providers'
import { addDays, formatDayLong, formatTime, today } from '../lib/dates'
import { Button } from './Button'
import { Icon } from './Icon'
import { EmptyState, ErrorState, LoadingState } from './QueryStates'

export function SlotPicker({
  providerId,
  serviceId,
  date,
  onDateChange,
  selected,
  onSelect,
}: {
  providerId: string
  serviceId: string
  date: string
  onDateChange: (date: string) => void
  selected: string | null
  onSelect: (slot: string) => void
}) {
  const minDate = today()
  const inputId = useId()
  const query = useSlotsQuery({ providerId, serviceId, date })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={`${inputId}-date`} className="block text-sm font-semibold text-ink">
            Día
          </label>
          <input
            id={`${inputId}-date`}
            type="date"
            min={minDate}
            value={date}
            onChange={(event) => event.target.value && onDateChange(event.target.value)}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-ink focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus"
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-2" aria-label="Horarios disponibles">
          {query.data.map((slot) => (
            <li key={slot}>
              <button
                type="button"
                aria-pressed={selected === slot}
                onClick={() => onSelect(slot)}
                className={`min-h-11 w-full whitespace-nowrap rounded-full border px-2 py-2 text-sm font-semibold tabular-nums transition-[border-color,background-color,color,translate,scale] duration-200 hover:-translate-y-px active:scale-95 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  selected === slot ? 'border-accent bg-accent text-on-accent motion-safe:animate-pop' : 'border-line-strong bg-surface text-ink hover:border-accent'
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
