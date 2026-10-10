export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      // Reduced motion slows the spin instead of hiding it: loading feedback still matters.
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:[animation-duration:2.5s] ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-accent-ink">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
