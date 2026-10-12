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
  calendar: 'M7 3v3M17 3v3M5 5.5h14a1 1 0 011 1V19a1 1 0 01-1 1H5a1 1 0 01-1-1V6.5a1 1 0 011-1zM4 10h16',
  users: 'M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19M10 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM20 19v-1.5a3.5 3.5 0 00-2.5-3.3M15.5 4.2a3.5 3.5 0 010 6.6',
  chart: 'M5 20V11M12 20V4M19 20v-6',
  tag: 'M3.5 12.2V4.5h7.7l8.8 8.8-7.7 7.7-8.8-8.8zM7.8 8.3h.01',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  download: 'M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14',
  'chevron-down': 'M6 9.5l6 6 6-6',
  'file-text': 'M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6',
  table: 'M4 5h16v14H4zM4 10h16M10 5v14',
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
