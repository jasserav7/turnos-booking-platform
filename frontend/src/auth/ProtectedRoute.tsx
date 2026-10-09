import { Navigate, Outlet, useLocation } from 'react-router'
import type { UserRole } from '../api/types'
import { FullPageSpinner } from '../components/Spinner'
import ForbiddenPage from '../pages/ForbiddenPage'
import { useAuth } from './useAuth'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <ForbiddenPage />
  return <Outlet />
}

/** Routes only for visitors without a session (login, register...). */
export function GuestRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
