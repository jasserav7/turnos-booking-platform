import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { useForgotPasswordMutation } from '../api/auth'
import { Alert } from '../components/Alert'
import { AuthCard } from '../components/AuthCard'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { errorMessage } from '../lib/errors'
import { forgotPasswordSchema, type ForgotPasswordForm } from '../lib/validation'

export default function ForgotPasswordPage() {
  const mutation = useForgotPasswordMutation()
  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace para crear una contraseña nueva."
      footer={
        <Link to="/login" className="font-medium text-accent-ink hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {mutation.isSuccess ? (
        <Alert variant="success">
          Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
          Revisa también la carpeta de spam.
        </Alert>
      ) : (
        <>
          {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
          <form className="space-y-4" noValidate onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <TextField
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Button type="submit" loading={mutation.isPending}>
              {mutation.isPending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        </>
      )}
    </AuthCard>
  )
}
