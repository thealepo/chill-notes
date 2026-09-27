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
    <fieldset className="theme-setting">
      <legend className="theme-setting-label">Appearance</legend>
      <div className="theme-switcher">
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <label
            key={optionValue}
            className={value === optionValue ? 'active' : ''}
            title={`${label} theme`}
          >
            <input
              type="radio"
              name="theme-preference"
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
            />
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
