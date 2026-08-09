import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ThemeContext, type ResolvedTheme, type Theme } from '@/lib/theme-context'

const STORAGE_KEY = 'careerlens.theme'

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // ignore storage errors
  }
  return 'system'
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemDark, setSystemDark] = useState(prefersDark)

  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const applyTheme = useCallback((next: ResolvedTheme) => {
    const root = document.documentElement
    root.classList.toggle('dark', next === 'dark')
    root.style.colorScheme = next
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme, applyTheme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}