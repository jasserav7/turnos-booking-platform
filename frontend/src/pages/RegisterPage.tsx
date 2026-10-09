import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { AuthCard } from '../components/AuthCard'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { errorMessage } from '../lib/errors'
import { registerSchema, type RegisterForm } from '../lib/validation'

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: '', password: '', confirm_password: '' },
  })
  const mutation = useMutation({
    mutationFn: ({ full_name, email, password }: RegisterForm) =>
      registerUser({ full_name, email, password }),
  })
  const { errors } = form.formState

  if (mutation.isSuccess) {
    return (
      <AuthCard title="¡Cuenta creada!">
        <Alert variant="success">
          Te enviamos un correo a <strong>{mutation.data.email}</strong> para verificar tu cuenta.
        </Alert>
        <Link
          to="/login"
          className="block rounded-md bg-indigo-600 px-4 py-2 text-center font-medium text-white hover:bg-indigo-700"
        >
          Ir a iniciar sesión
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Regístrate para reservar citas con nuestros profesionales."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
      <form className="space-y-4" noValidate onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <TextField
          label="Nombre completo"
          autoComplete="name"
          error={errors.full_name?.message}
          {...form.register('full_name')}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...form.register('confirm_password')}
        />
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthCard>
  )
}
