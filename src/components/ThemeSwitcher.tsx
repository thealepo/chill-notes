import { Laptop, Moon, Sun } from 'lucide-react'
import type { ThemePreference } from '../hooks/useTheme'

interface ThemeSwitcherProps {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

const options = [
  { value: 'system', label: 'System', icon: Laptop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] satisfies { value: ThemePreference; label: string; icon: typeof Sun }[]

export function ThemeSwitcher({ value, onChange }: ThemeSwitcherProps) {
  return (
    <div className="theme-setting">
      <span className="theme-setting-label" id="theme-setting-label">Appearance</span>
      <div className="theme-switcher" role="radiogroup" aria-labelledby="theme-setting-label">
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <button
            key={optionValue}
            className={value === optionValue ? 'active' : ''}
            type="button"
            role="radio"
            aria-checked={value === optionValue}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => onChange(optionValue)}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
