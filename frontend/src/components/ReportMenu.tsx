import { useEffect, useId, useRef, useState } from 'react'
import { useDownloadReportMutation, type ReportFormat } from '../api/reports'
import { addDays, today } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { Alert } from './Alert'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'

const FORMATS: { value: ReportFormat; label: string; hint: string; icon: IconName }[] = [
  { value: 'csv', label: 'CSV', hint: 'Para abrir en Excel o analizar los datos', icon: 'file-text' },
  { value: 'xlsx', label: 'Excel (XLSX)', hint: 'Hoja de resumen y hoja con el detalle', icon: 'table' },
  { value: 'pdf', label: 'PDF', hint: 'Listo para imprimir o compartir', icon: 'file-text' },
]

const dateInputClass =
  'block min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus'

/** Report download: pick a date range, then a file format. */
export function ReportMenu() {
  const [open, setOpen] = useState(false)
  const [dateTo, setDateTo] = useState(today)
  const [dateFrom, setDateFrom] = useState(() => addDays(today(), -29))
  const [pending, setPending] = useState<ReportFormat | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const mutation = useDownloadReportMutation()
  const invalidRange = dateFrom > dateTo

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function download(format: ReportFormat) {
    setPending(format)
    mutation.mutate(
      { format, dateFrom, dateTo },
      {
        onSuccess: () => {
          setOpen(false)
          triggerRef.current?.focus()
        },
        onSettled: () => setPending(null),
      },
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        block={false}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="download" className="h-4 w-4" />
        Descargar reporte
        <Icon
          name="chevron-down"
          className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Descargar reporte de reservas"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right space-y-4 rounded-2xl bg-surface p-4 shadow-overlay ring-1 ring-line motion-safe:animate-rise"
        >
          <div>
            <p className="font-bold text-ink">Reporte de reservas</p>
            <p className="text-sm text-ink-muted">Elige el período y el formato del archivo.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${panelId}-from`} className="block text-sm font-semibold text-ink">
                Desde
              </label>
              <input
                id={`${panelId}-from`}
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => event.target.value && setDateFrom(event.target.value)}
                className={dateInputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${panelId}-to`} className="block text-sm font-semibold text-ink">
                Hasta
              </label>
              <input
                id={`${panelId}-to`}
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(event) => event.target.value && setDateTo(event.target.value)}
                className={dateInputClass}
              />
            </div>
          </div>
          {invalidRange && <Alert variant="error">La fecha final no puede ser anterior a la inicial.</Alert>}
          {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
          <ul className="space-y-1.5">
            {FORMATS.map((format) => (
              <li key={format.value}>
                <button
                  type="button"
                  disabled={invalidRange || pending !== null}
                  aria-busy={pending === format.value}
                  onClick={() => download(format.value)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left transition-[background-color,border-color,scale] duration-200 hover:border-accent hover:bg-accent-soft active:scale-[0.98] disabled:border-line disabled:bg-sunken disabled:opacity-70 disabled:hover:border-line disabled:hover:bg-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-ink transition-colors duration-200 group-enabled:group-hover:bg-accent group-enabled:group-hover:text-on-accent">
                    {pending === format.value ? <Spinner className="h-4 w-4" /> : <Icon name={format.icon} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{format.label}</span>
                    <span className="block text-sm text-ink-muted">{format.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
