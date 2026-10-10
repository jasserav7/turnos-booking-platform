import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Native <dialog>: focus trap, Escape to close and inert background come for free. */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="modal-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-surface p-0 text-ink shadow-overlay"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-m-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors duration-150 hover:bg-sunken hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Icon name="x" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
