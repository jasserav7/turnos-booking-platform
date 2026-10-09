import { z } from 'zod'

// Limits mirror the OpenAPI schema (RegisterIn / ResetPasswordIn).
const email = z.string().trim().min(1, 'Ingresa tu correo.').pipe(z.email('Ingresa un correo válido.'))
const newPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede superar 128 caracteres.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, 'Ingresa tu nombre.')
      .max(255, 'El nombre no puede superar 255 caracteres.'),
    email,
    password: newPassword,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    error: 'Las contraseñas no coinciden.',
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ['confirm_password'],
    error: 'Las contraseñas no coinciden.',
  })

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>
