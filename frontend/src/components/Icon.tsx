const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  x: 'M6 6l12 12M18 6L6 18',
  'check-circle': 'M8.5 12.5l2.5 2.5 4.5-5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'x-circle': 'M9.5 9.5l5 5m0-5l-5 5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'chevron-left': 'M14.5 6l-6 6 6 6',
  'chevron-right': 'M9.5 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 3v1.5M12 19.5V21M4.6 4.6l1.1 1.1M18.3 18.3l1.1 1.1M3 12h1.5M19.5 12H21M4.6 19.4l1.1-1.1M18.3 5.7l1.1-1.1M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  monitor: 'M4 5h16v11H4zM9 20h6M12 16v4',
} as const

export type IconName = keyof typeof PATHS

/** Authored 24px line icons, one stroke weight; decorative unless labelled by the parent. */
export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
