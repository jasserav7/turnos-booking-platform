import { Button } from './Button'

export function RouteError() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Algo salió mal</h1>
      <p className="mt-2 text-ink-muted">
        Puede que haya una versión nueva de la página. Recarga para continuar.
      </p>
      <div className="mt-6 flex justify-center">
        <Button type="button" onClick={() => window.location.reload()}>
          Recargar
        </Button>
      </div>
    </div>
  )
}
