import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-xl bg-surface p-6 ring-1 ring-line sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-6 space-y-4">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>}
    </div>
  )
}
