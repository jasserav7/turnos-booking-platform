import { Link } from 'react-router'
import { useServicesQuery } from '../api/services'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Spinner } from '../components/Spinner'
import { errorMessage } from '../lib/errors'
import { NAV_BY_ROLE, ROLE_LABELS } from '../lib/navigation'

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function ServicesList() {
  const { data, isPending, isError, error, refetch } = useServicesQuery()

  if (isPending) {
    return (
      <div className="flex items-center gap-3 text-gray-600">
        <Spinner /> Cargando servicios…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="space-y-2">
        <Alert variant="error">{errorMessage(error)}</Alert>
        <button type="button" onClick={() => void refetch()} className="text-sm font-medium text-indigo-600 hover:underline">
          Reintentar
        </button>
      </div>
    )
  }
  if (data.length === 0) {
    return <p className="text-gray-600">Todavía no hay servicios disponibles.</p>
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((service) => (
        <li key={service.id} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="font-medium text-gray-900">{service.name}</p>
          {service.description && <p className="mt-1 text-sm text-gray-600">{service.description}</p>}
          <p className="mt-2 text-sm text-gray-500">
            {service.duration_minutes} min · {currency.format(service.price_cents / 100)}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default function HomePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="space-y-10">
        <section className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Reserva tu cita en minutos</h1>
          <p className="mx-auto mt-3 max-w-xl text-gray-600">
            Elige el servicio, el profesional y el horario que mejor te quede.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700">
              Crear cuenta
            </Link>
            <Link to="/login" className="rounded-md border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
              Iniciar sesión
            </Link>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Servicios</h2>
          <ServicesList />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-gray-900">Hola, {user.full_name}</h1>
        <p className="mt-1 text-gray-600">Entraste como {ROLE_LABELS[user.role].toLowerCase()}.</p>
        {!user.email_verified_at && (
          <div className="mt-4">
            <Alert>Aún no verificas tu correo. Revisa tu bandeja de entrada.</Alert>
          </div>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NAV_BY_ROLE[user.role].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg bg-white p-5 font-medium text-gray-900 shadow-sm ring-1 ring-gray-200 hover:ring-indigo-300"
          >
            {item.label} →
          </Link>
        ))}
      </section>
      {user.role === 'customer' && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Servicios disponibles</h2>
          <ServicesList />
        </section>
      )}
    </div>
  )
}
