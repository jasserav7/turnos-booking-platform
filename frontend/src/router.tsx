import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { RouteError } from './components/RouteError'
import { FullPageSpinner } from './components/Spinner'
import ForbiddenPage from './pages/ForbiddenPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

const RELOAD_KEY = 'chunk-reload-at'

// A new deploy renames the hashed chunks, so a tab opened before it fails to import them.
// Reload once (at most every 10s) to pick up the new index.html; otherwise surface the error.
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 10_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

// Role sections are loaded on demand to keep the initial bundle small.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => {
  try {
    return { Component: (await load()).default }
  } catch (error) {
    if (reloadOnce()) return new Promise<never>(() => {})
    throw error
  }
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
      {
        element: <GuestRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['customer']} />,
        children: [
          { path: 'book', lazy: page(() => import('./pages/customer/BookPage')) },
          { path: 'bookings', lazy: page(() => import('./pages/customer/MyBookingsPage')) },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['provider']} />,
        children: [
          { path: 'agenda', lazy: page(() => import('./pages/provider/AgendaPage')) },
          { path: 'availability', lazy: page(() => import('./pages/provider/AvailabilityPage')) },
        ],
      },
      {
        path: 'admin',
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          { path: 'services', lazy: page(() => import('./pages/admin/AdminServicesPage')) },
          { path: 'providers', lazy: page(() => import('./pages/admin/AdminProvidersPage')) },
          { path: 'users', lazy: page(() => import('./pages/admin/AdminUsersPage')) },
          { path: 'bookings', lazy: page(() => import('./pages/admin/AdminBookingsPage')) },
          { path: 'stats', lazy: page(() => import('./pages/admin/AdminStatsPage')) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
