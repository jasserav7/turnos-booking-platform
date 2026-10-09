import type { BookingStatus } from '../api/types'
import { STATUS_LABELS } from '../lib/format'

const STYLES: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  confirmed: 'bg-green-50 text-green-800 ring-green-600/30',
  cancelled: 'bg-gray-100 text-gray-700 ring-gray-500/30',
  completed: 'bg-indigo-50 text-indigo-800 ring-indigo-600/30',
}

const ICONS: Record<BookingStatus, string> = {
  pending: '◷',
  confirmed: '✓',
  cancelled: '✕',
  completed: '★',
}

/** Status shown with text and icon, never color alone. */
export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>
      <span aria-hidden="true">{ICONS[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  )
}
