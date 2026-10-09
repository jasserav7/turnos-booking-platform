import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-bold text-indigo-600">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900">Página no encontrada</h1>
      <p className="mt-2 text-gray-600">La dirección que buscas no existe o fue movida.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-indigo-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
