import type { CSSProperties } from 'react'

/** Staggered entrance delay for list items; capped so long lists never feel slow. */
export function stagger(index: number, step = 50, max = 8): CSSProperties {
  return { animationDelay: `${Math.min(index, max) * step}ms` }
}
