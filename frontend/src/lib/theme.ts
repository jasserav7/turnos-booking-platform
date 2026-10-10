export type ThemePreference = 'system' | 'light' | 'dark'

// Must match the inline script in index.html, which applies the theme before first paint.
const STORAGE_KEY = 'turnos-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyPreference(preference: ThemePreference): void {
  const dark = preference === 'dark' || (preference === 'system' && media().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}

/** Re-apply when the OS theme changes while following the system. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = media()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
