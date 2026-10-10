import { Button } from './Button'

interface PaginationProps {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  if (total <= limit) return null
  const from = offset + 1
  const to = Math.min(offset + limit, total)
  return (
    <nav className="flex items-center justify-between gap-4 pt-4" aria-label="Paginación">
      <p className="text-sm text-ink-muted">
        {from}–{to} de {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" block={false} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Anterior
        </Button>
        <Button variant="secondary" size="sm" block={false} disabled={to >= total} onClick={() => onChange(offset + limit)}>
          Siguiente
        </Button>
      </div>
    </nav>
  )
}
