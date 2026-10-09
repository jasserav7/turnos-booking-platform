import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { NAV_BY_ROLE, ROLE_LABELS, type NavItem } from '../lib/navigation'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
  }`

export function Layout() {
  const { user, status, logout } = useAuth()
  const location = useLocation()
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  // The mobile menu closes itself whenever the route changes.
  const menuOpen = menuPath === location.pathname

  const items: NavItem[] = user
    ? NAV_BY_ROLE[user.role]
    : [
        { to: '/login', label: 'Iniciar sesión' },
        { to: '/register', label: 'Crear cuenta' },
      ]

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  const userBox = user && (
    <div className="flex items-center gap-3">
      <div className="text-right text-sm leading-tight">
        <p className="font-medium text-gray-900">{user.full_name}</p>
        <p className="text-gray-500">{ROLE_LABELS[user.role]}</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
      </button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            Turnos
          </Link>
          {status !== 'loading' && (
            <>
              <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Principal">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="hidden md:block">{userBox}</div>
              <button
                type="button"
                className="rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                onClick={() => setMenuPath(menuOpen ? null : location.pathname)}
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  {menuOpen ? (
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          )}
        </div>
        {menuOpen && (
          <div id="mobile-menu" className="space-y-3 border-t border-gray-200 px-4 py-3 md:hidden">
            <nav className="space-y-1" aria-label="Principal móvil">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {userBox}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
