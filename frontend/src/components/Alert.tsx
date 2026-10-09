import type { ReactNode } from 'react'

const STYLES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800',
} as const

interface AlertProps {
  variant?: keyof typeof STYLES
  children: ReactNode
}

export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-4 py-3 text-sm ${STYLES[variant]}`}
    >
      {children}
    </div>
  )
}
