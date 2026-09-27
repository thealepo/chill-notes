import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const THEME_STORAGE_KEY = 'chill-notes-theme'

const themeColors: Record<ResolvedTheme, string> = {
  light: '#f8f3f2',
  dark: '#241a22',
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function getStoredPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme])
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredPreference()))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    function handleSystemChange() {
      if (preference !== 'system') return
      const nextTheme = media.matches ? 'dark' : 'light'
      setResolvedTheme(nextTheme)
      applyTheme(nextTheme)
    }

    handleSystemChange()
    media.addEventListener('change', handleSystemChange)
    return () => media.removeEventListener('change', handleSystemChange)
  }, [preference])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return
      setPreferenceState(isThemePreference(event.newValue) ? event.newValue : 'system')
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    try {
      if (nextPreference === 'system') {
        window.localStorage.removeItem(THEME_STORAGE_KEY)
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
      }
    } catch {
      // The UI still follows the selection when storage is unavailable.
    }

    const nextTheme = resolveTheme(nextPreference)
    setPreferenceState(nextPreference)
    setResolvedTheme(nextTheme)
    applyTheme(nextTheme)
  }, [])

  return { preference, resolvedTheme, setPreference }
}
