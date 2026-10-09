import type { UserRole } from '../api/types'

export interface NavItem {
  to: string
  label: string
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  customer: [
    { to: '/book', label: 'Reservar' },
    { to: '/bookings', label: 'Mis reservas' },
  ],
  provider: [
    { to: '/agenda', label: 'Mi agenda' },
    { to: '/availability', label: 'Disponibilidad' },
  ],
  admin: [
    { to: '/admin/services', label: 'Servicios' },
    { to: '/admin/providers', label: 'Profesionales' },
    { to: '/admin/users', label: 'Usuarios' },
    { to: '/admin/bookings', label: 'Reservas' },
    { to: '/admin/stats', label: 'Estadísticas' },
  ],
}

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Cliente',
  provider: 'Profesional',
  admin: 'Administrador',
}
