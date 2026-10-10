import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { AuthCard } from '../components/AuthCard'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { errorMessage } from '../lib/errors'
import { loginSchema, type LoginForm } from '../lib/validation'

interface LoginState {
  from?: string
  notice?: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as LoginState
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate(state.from ?? '/', { replace: true }),
  })
  const { errors } = form.formState

  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Accede para gestionar tus reservas."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-medium text-accent-ink hover:underline">
            Regístrate
          </Link>
        </>
      }
    >
      {state.notice && <Alert variant="success">{state.notice}</Alert>}
      {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
      <form className="space-y-4" noValidate onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="text-accent-ink hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </AuthCard>
  )
}
