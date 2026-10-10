const VARIANTS = {
  primary: 'bg-accent text-on-accent shadow-card hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunken',
  danger: 'bg-danger text-on-danger shadow-card hover:bg-danger-hover',
} as const

type Variant = keyof typeof VARIANTS
type Size = 'md' | 'sm'

export interface ButtonStyleOptions {
  variant?: Variant
  size?: Size
  block?: boolean
}

/** Shared look for buttons and button-styled links. Disabled reads as neutral, not as a faded accent. */
export function buttonClasses({ variant = 'primary', size = 'md', block = true }: ButtonStyleOptions = {}): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-ink-subtle disabled:shadow-none',
    size === 'sm' ? 'min-h-9 px-3 py-1.5 text-sm' : 'min-h-11 px-4 py-2',
    block ? 'w-full' : '',
    VARIANTS[variant],
  ].join(' ')
}
