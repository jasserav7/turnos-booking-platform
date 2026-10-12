export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" className="fill-accent" />
      <rect x="8" y="9" width="16" height="15" rx="3.5" fill="none" className="stroke-on-accent" strokeWidth={2} />
      <path d="M8 14.5h16M12.5 7v4M19.5 7v4" className="stroke-on-accent" strokeWidth={2} strokeLinecap="round" />
      <circle cx="19" cy="19.5" r="2.3" className="fill-on-accent" />
    </svg>
  )
}
