import type { UserRole } from '../api/types'
import type { IconName } from '../components/Icon'

export interface NavItem {
  to: string
  label: string
  icon?: IconName
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  customer: [
    { to: '/book', label: 'Reservar', icon: 'calendar' },
    { to: '/bookings', label: 'Mis reservas', icon: 'list' },
  ],
  provider: [
    { to: '/agenda', label: 'Mi agenda', icon: 'calendar' },
    { to: '/availability', label: 'Disponibilidad', icon: 'sliders' },
  ],
  admin: [
    { to: '/admin/services', label: 'Servicios', icon: 'tag' },
    { to: '/admin/providers', label: 'Profesionales', icon: 'briefcase' },
    { to: '/admin/users', label: 'Usuarios', icon: 'users' },
    { to: '/admin/bookings', label: 'Reservas', icon: 'list' },
    { to: '/admin/stats', label: 'Estadísticas', icon: 'chart' },
  ],
}

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Cliente',
  provider: 'Profesional',
  admin: 'Administrador',
}
