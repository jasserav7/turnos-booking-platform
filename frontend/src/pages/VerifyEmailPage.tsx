import { Link, useSearchParams } from 'react-router'
import { useVerifyEmailQuery } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { AuthCard } from '../components/AuthCard'
import { Spinner } from '../components/Spinner'
import { errorMessage } from '../lib/errors'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { user } = useAuth()
  const query = useVerifyEmailQuery(token)
  const next = user ? { to: '/', label: 'Ir al inicio' } : { to: '/login', label: 'Iniciar sesión' }

  return (
    <AuthCard title="Verificar correo">
      {!token && <Alert variant="error">El enlace no contiene un token de verificación.</Alert>}
      {token && query.isPending && (
        <div className="flex items-center gap-3 text-gray-700">
          <Spinner /> Verificando tu correo…
        </div>
      )}
      {query.isSuccess && <Alert variant="success">¡Listo! Tu correo quedó verificado.</Alert>}
      {query.isError && <Alert variant="error">{errorMessage(query.error)}</Alert>}
      {(!token || !query.isPending) && (
        <Link to={next.to} className="block text-center font-medium text-indigo-600 hover:underline">
          {next.label}
        </Link>
      )}
    </AuthCard>
  )
}
