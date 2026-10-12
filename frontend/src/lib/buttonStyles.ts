// Each action has its own feel: primary lifts, secondary tints toward the accent, danger gets a warning halo.
const VARIANTS = {
  primary:
    'bg-accent text-on-accent shadow-card hover:-translate-y-px hover:bg-accent-hover hover:shadow-lift active:translate-y-0 active:shadow-card',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft hover:text-accent-soft-ink',
  danger:
    'bg-danger text-on-danger shadow-card hover:bg-danger-hover hover:shadow-[0_0_0_4px_var(--danger-soft)]',
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
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
    'transition-[background-color,border-color,color,box-shadow,translate,scale] duration-200 ease-out',
    'active:scale-[0.97] motion-reduce:transition-none',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-ink-subtle disabled:shadow-none disabled:translate-y-0 disabled:scale-100',
    size === 'sm' ? 'min-h-9 px-3 py-1.5 text-sm' : 'min-h-11 px-4 py-2',
    block ? 'w-full' : '',
    VARIANTS[variant],
  ].join(' ')
}
