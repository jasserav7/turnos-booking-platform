import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { NAV_BY_ROLE, ROLE_LABELS, type NavItem } from '../lib/navigation'
import { BrandMark } from './Brand'
import { Icon } from './Icon'
import { ThemeToggle } from './ThemeToggle'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 md:min-h-9 ${focusRing} ${
    isActive ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-muted hover:bg-sunken hover:text-ink'
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

  const userBox = (align: 'start' | 'end') =>
    user && (
      <div className={`flex items-center gap-3 ${align === 'end' ? 'justify-end' : 'justify-between'}`}>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-soft-ink"
          aria-hidden="true"
        >
          {initials(user.full_name)}
        </span>
        <div className={`min-w-0 text-sm leading-tight ${align === 'end' ? 'hidden max-w-52 text-left xl:block' : 'flex-1'}`}>
          <p className="truncate font-semibold text-ink">{user.full_name}</p>
          <p className="truncate text-ink-subtle">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border border-line-strong px-3.5 text-sm font-semibold text-ink-muted transition-[background-color,color,translate,scale] duration-200 hover:bg-sunken hover:text-ink active:scale-[0.97] disabled:opacity-60 ${focusRing}`}
        >
          {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    )

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/" className={`group -m-1 flex items-center gap-2 rounded-lg p-1 ${focusRing}`}>
            <BrandMark className="h-8 w-8 transition-transform duration-300 ease-out group-hover:-rotate-6 motion-reduce:transition-none" />
            <span className="text-lg font-bold tracking-tight text-ink">Turnos</span>
          </Link>
          {status !== 'loading' && (
            <nav className="hidden flex-1 items-center gap-1 pl-4 md:flex" aria-label="Principal">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.icon && <Icon name={item.icon} className="hidden h-4 w-4 2xl:block" />}
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
          <div id="mobile-menu" className="space-y-3 motion-safe:animate-rise border-t border-line px-4 pb-4 pt-3 md:hidden">
            <nav className="space-y-1" aria-label="Principal móvil">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.icon && <Icon name={item.icon} className="h-4 w-4" />}
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {user && <div className="border-t border-line pt-3">{userBox('start')}</div>}
          </div>
        )}
      </header>
      <main key={location.pathname} className="motion-safe:animate-fade mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
