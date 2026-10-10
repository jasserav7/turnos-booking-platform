import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

const STYLES = {
  error: 'border-danger-line bg-danger-soft text-danger-ink',
  success: 'border-success-line bg-success-soft text-success-ink',
  info: 'border-line bg-accent-soft text-accent-soft-ink',
} as const

const ICONS: Record<keyof typeof STYLES, IconName> = {
  error: 'x-circle',
  success: 'check-circle',
  info: 'clock',
}

interface AlertProps {
  variant?: keyof typeof STYLES
  children: ReactNode
}

export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm leading-relaxed ${STYLES[variant]}`}
    >
      <Icon name={ICONS[variant]} className="mt-0.5 h-4 w-4" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
