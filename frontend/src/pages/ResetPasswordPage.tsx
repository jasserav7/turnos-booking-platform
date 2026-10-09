import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useResetPasswordMutation } from '../api/auth'
import { Alert } from '../components/Alert'
import { AuthCard } from '../components/AuthCard'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { errorMessage } from '../lib/errors'
import { resetPasswordSchema, type ResetPasswordForm } from '../lib/validation'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const mutation = useResetPasswordMutation()
  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })
  const { errors } = form.formState

  if (!token) {
    return (
      <AuthCard title="Restablecer contraseña">
        <Alert variant="error">El enlace no contiene un token válido.</Alert>
        <Link to="/forgot-password" className="block text-center font-medium text-indigo-600 hover:underline">
          Solicitar un enlace nuevo
        </Link>
      </AuthCard>
    )
  }

  const onSubmit = (data: ResetPasswordForm) =>
    mutation.mutate(
      { token, new_password: data.new_password },
      {
        onSuccess: () =>
          navigate('/login', {
            replace: true,
            state: { notice: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' },
          }),
      },
    )

  return (
    <AuthCard
      title="Restablecer contraseña"
      subtitle="Elige una contraseña nueva de al menos 8 caracteres."
      footer={
        <Link to="/forgot-password" className="font-medium text-indigo-600 hover:underline">
          Solicitar un enlace nuevo
        </Link>
      }
    >
      {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
      <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          error={errors.new_password?.message}
          {...form.register('new_password')}
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...form.register('confirm_password')}
        />
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthCard>
  )
}
