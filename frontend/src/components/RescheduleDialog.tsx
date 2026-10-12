import { useState } from 'react'
import { useRescheduleBookingMutation } from '../api/bookings'
import type { Booking } from '../api/types'
import { addDays, dayOf, formatDateTime, today } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { Alert } from './Alert'
import { Button } from './Button'
import { Modal } from './Modal'
import { SlotPicker } from './SlotPicker'

interface RescheduleDialogProps {
  booking: Booking | null
  onClose: () => void
}

function Body({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [date, setDate] = useState(() => {
    const current = dayOf(booking.starts_at)
    return current < today() ? addDays(today(), 1) : current
  })
  const [slot, setSlot] = useState<string | null>(null)
  const mutation = useRescheduleBookingMutation()

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!slot) return
        mutation.mutate(
          { id: booking.id, startsAt: slot },
          {
            onSuccess: onClose,
            // The slots reload after a conflict, so the old choice is no longer valid.
            onError: () => setSlot(null),
          },
        )
      }}
    >
      <p className="text-ink-muted">
        {booking.service_name} con {booking.provider_name}. Hora actual:{' '}
        <strong>{formatDateTime(booking.starts_at)}</strong>
      </p>
      {booking.status === 'confirmed' && (
        <Alert>Si cambias la hora, el profesional tendrá que confirmarla de nuevo.</Alert>
      )}
      <SlotPicker
        providerId={booking.provider_id}
        serviceId={booking.service_id}
        date={date}
        onDateChange={(next) => {
          setDate(next)
          setSlot(null)
        }}
        selected={slot}
        onSelect={setSlot}
      />
      {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" block={false} onClick={onClose}>
          Volver
        </Button>
        <Button type="submit" block={false} disabled={!slot} loading={mutation.isPending}>
          Reprogramar reserva
        </Button>
      </div>
    </form>
  )
}

export function RescheduleDialog({ booking, onClose }: RescheduleDialogProps) {
  return (
    <Modal open={booking !== null} title="Reprogramar reserva" onClose={onClose}>
      {booking && <Body key={booking.id} booking={booking} onClose={onClose} />}
    </Modal>
  )
}
