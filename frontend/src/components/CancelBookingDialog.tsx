import { useState } from 'react'
import { useBookingActionMutation } from '../api/bookings'
import type { Booking } from '../api/types'
import { formatDateTime } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { Alert } from './Alert'
import { Button } from './Button'
import { Modal } from './Modal'
import { TextAreaField } from './TextAreaField'

interface CancelBookingDialogProps {
  booking: Booking | null
  description?: string
  onClose: () => void
}

export function CancelBookingDialog({ booking, description, onClose }: CancelBookingDialogProps) {
  const [reason, setReason] = useState('')
  const mutation = useBookingActionMutation()

  function close() {
    setReason('')
    mutation.reset()
    onClose()
  }

  return (
    <Modal open={booking !== null} title="Cancelar reserva" onClose={close}>
      {booking && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate({ id: booking.id, action: 'cancel', reason: reason.trim() }, { onSuccess: close })
          }}
        >
          <p className="text-ink-muted">
            ¿Seguro que quieres cancelar la reserva del <strong>{formatDateTime(booking.starts_at)}</strong>?
            {description && <> {description}</>}
          </p>
          <TextAreaField
            label="Motivo (opcional)"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" block={false} onClick={close}>
              Volver
            </Button>
            <Button type="submit" variant="danger" block={false} loading={mutation.isPending}>
              Cancelar reserva
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
