import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-bold text-accent-ink">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Página no encontrada</h1>
      <p className="mt-2 text-ink-muted">La dirección que buscas no existe o fue movida.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-accent-ink hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
