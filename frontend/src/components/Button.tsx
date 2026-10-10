import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonClasses, type ButtonStyleOptions } from '../lib/buttonStyles'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  loading?: boolean
}

export function Button({
  loading = false,
  variant,
  size,
  block,
  type = 'button',
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`${buttonClasses({ variant, size, block })} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, block = false, className = '', ...props }: LinkProps & ButtonStyleOptions) {
  return <Link {...props} className={`${buttonClasses({ variant, size, block })} ${className}`} />
}
