import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { NAV_BY_ROLE, ROLE_LABELS, type NavItem } from '../lib/navigation'
import { Icon } from './Icon'
import { ThemeToggle } from './ThemeToggle'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-150 md:min-h-9 ${focusRing} ${
    isActive ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-muted hover:bg-sunken hover:text-ink'
  }`

function BrandMark() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M9 10.5h14M16 10.5V23" className="stroke-on-accent" strokeWidth={3} strokeLinecap="round" />
      <circle cx="22.5" cy="21.5" r="2.5" className="fill-on-accent" />
    </svg>
  )
}

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

  const userBox = (align: 'start' | 'end') =>
    user && (
      <div className={`flex items-center gap-3 ${align === 'end' ? 'justify-end' : 'justify-between'}`}>
        <div className={`text-sm leading-tight ${align === 'end' ? 'text-right' : ''}`}>
          <p className="font-medium text-ink">{user.full_name}</p>
          <p className="text-ink-subtle">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={`min-h-9 rounded-lg border border-line-strong px-3 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:opacity-60 ${focusRing}`}
        >
          {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    )

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className={`-m-1 flex items-center gap-2 rounded-lg p-1 ${focusRing}`}>
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight text-ink">Turnos</span>
          </Link>
          {status !== 'loading' && (
            <nav className="hidden flex-1 items-center gap-1 pl-4 md:flex" aria-label="Principal">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {status !== 'loading' && (
              <>
                <div className="hidden md:block">{userBox('end')}</div>
                <button
                  type="button"
                  className={`flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-sunken md:hidden ${focusRing}`}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-menu"
                  aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                  onClick={() => setMenuPath(menuOpen ? null : location.pathname)}
                >
                  <Icon name={menuOpen ? 'x' : 'menu'} className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
        {menuOpen && (
          <div id="mobile-menu" className="space-y-3 border-t border-line px-4 pb-4 pt-3 md:hidden">
            <nav className="space-y-1" aria-label="Principal móvil">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {user && <div className="border-t border-line pt-3">{userBox('start')}</div>}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
