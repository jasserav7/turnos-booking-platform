import { createBrowserRouter } from 'react-router'
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import ComingSoonPage from './pages/ComingSoonPage'
import ForbiddenPage from './pages/ForbiddenPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
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
          { path: 'book', element: <ComingSoonPage title="Reservar" /> },
          { path: 'bookings', element: <ComingSoonPage title="Mis reservas" /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['provider']} />,
        children: [
          { path: 'agenda', element: <ComingSoonPage title="Mi agenda" /> },
          { path: 'availability', element: <ComingSoonPage title="Disponibilidad" /> },
        ],
      },
      {
        path: 'admin',
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          { path: 'services', element: <ComingSoonPage title="Servicios" /> },
          { path: 'users', element: <ComingSoonPage title="Usuarios" /> },
          { path: 'bookings', element: <ComingSoonPage title="Reservas" /> },
          { path: 'stats', element: <ComingSoonPage title="Estadísticas" /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
