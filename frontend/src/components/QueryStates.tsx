import type { ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { Alert } from './Alert'
import { Button } from './Button'
import { Spinner } from './Spinner'

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-6 text-gray-600">
      <Spinner /> {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="space-y-3">
      <Alert variant="error">{errorMessage(error)}</Alert>
      {onRetry && (
        <Button variant="secondary" size="sm" block={false} onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-gray-900">{title}</p>
      {children && <div className="mt-1 text-sm text-gray-600">{children}</div>}
    </div>
  )
}
