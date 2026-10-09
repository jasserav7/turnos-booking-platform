import { ApiError } from '../api/client'

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_taken: 'Ya existe una cuenta con ese correo.',
  invalid_token: 'El enlace no es válido o ya expiró.',
  rate_limited: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
  validation_error: 'Revisa los datos del formulario.',
  network_error: 'No se pudo conectar con el servidor. Revisa tu conexión.',
  session_expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  not_authenticated: 'Debes iniciar sesión.',
  forbidden: 'No tienes permiso para realizar esta acción.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? `Ocurrió un error inesperado (${error.code}).`
  }
  return 'Ocurrió un error inesperado.'
}
