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
  slot_unavailable: 'Ese horario acaba de ocuparse o ya no está disponible. Elige otro.',
  invalid_transition: 'La reserva cambió de estado y ya no admite esta acción. Actualiza la lista.',
  cancellation_window_closed: 'Ya no puedes cancelar esta reserva: el plazo para cancelar terminó.',
  booking_not_found: 'La reserva no existe o no tienes acceso a ella.',
  service_not_found: 'El servicio no existe o está inactivo.',
  provider_not_found: 'El profesional no existe o no ofrece este servicio.',
  invalid_service: 'Alguno de los servicios seleccionados no existe.',
  overlapping_rules: 'Hay rangos que se solapan el mismo día.',
  invalid_rule: 'Cada rango debe terminar después de empezar.',
  invalid_range: 'La fecha final no puede ser anterior a la inicial.',
  range_too_large: 'El rango de fechas es demasiado amplio.',
  time_off_not_found: 'El bloqueo ya no existe.',
  user_not_found: 'El usuario no existe.',
  cannot_modify_self: 'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? `Ocurrió un error inesperado (${error.code}).`
  }
  return 'Ocurrió un error inesperado.'
}

export function isApiError(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code
}
