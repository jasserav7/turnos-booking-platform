import { useEffect, useState } from 'react'
import { applyPreference, readPreference, watchSystemTheme, type ThemePreference } from '../lib/theme'
import { Icon, type IconName } from './Icon'

const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Tema del sistema', icon: 'monitor' },
  { value: 'light', label: 'Tema claro', icon: 'sun' },
  { value: 'dark', label: 'Tema oscuro', icon: 'moon' },
]

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)

  useEffect(() => {
    applyPreference(preference)
    if (preference !== 'system') return
    return watchSystemTheme(() => applyPreference('system'))
  }, [preference])

  return (
    <div role="group" aria-label="Tema de color" className="inline-flex rounded-lg border border-line bg-sunken p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setPreference(option.value)}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            preference === option.value ? 'bg-surface text-ink shadow-card' : 'text-ink-subtle hover:text-ink'
          }`}
        >
          <Icon name={option.icon} className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
