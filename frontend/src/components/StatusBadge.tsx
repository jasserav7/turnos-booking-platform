import type { BookingStatus } from '../api/types'
import { STATUS_LABELS } from '../lib/format'
import { Icon, type IconName } from './Icon'

const STYLES: Record<BookingStatus, string> = {
  pending: 'bg-warning-soft text-warning-ink ring-warning-line',
  confirmed: 'bg-success-soft text-success-ink ring-success-line',
  cancelled: 'bg-neutral-soft text-neutral-ink ring-line-strong',
  completed: 'bg-accent-soft text-accent-soft-ink ring-accent',
}

const ICONS: Record<BookingStatus, IconName> = {
  pending: 'clock',
  confirmed: 'check',
  cancelled: 'x',
  completed: 'check-circle',
}

/** Status shown with text and icon, never color alone. */
export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>
      <Icon name={ICONS[status]} className="h-3.5 w-3.5" />
      {STATUS_LABELS[status]}
    </span>
  )
}

/** Same vocabulary for active/inactive toggles (services, users). */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        active ? 'bg-success-soft text-success-ink ring-success-line' : 'bg-neutral-soft text-neutral-ink ring-line-strong'
      }`}
    >
      <Icon name={active ? 'check' : 'x'} className="h-3.5 w-3.5" />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}
