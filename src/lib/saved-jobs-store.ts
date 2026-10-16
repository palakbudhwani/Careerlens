import { useCallback, useEffect, useState } from 'react'

/**
 * Saved-jobs state.
 *
 * Saved roles are a user preference, not sensitive data, so they persist in
 * localStorage under a single key (the same storage-backed pattern the app
 * already uses for settings). All components that render save toggles stay in
 * sync through the listener set below.
 */

const STORAGE_KEY = 'careerlens.savedJobs'

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function readSavedJobs(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function writeSavedJobs(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // storage may be unavailable
  }
  notify()
}

/** Toggle a job's saved state. Returns true when the job is saved afterwards. */
export function toggleSavedJob(id: string): boolean {
  const current = readSavedJobs()
  const next = current.includes(id)
    ? current.filter((entry) => entry !== id)
    : [...current, id]
  writeSavedJobs(next)
  return next.includes(id)
}

export function clearSavedJobs(): void {
  writeSavedJobs([])
}

/** Reactive list of saved job ids. */
export function useSavedJobs(): string[] {
  const [saved, setSaved] = useState<string[]>(readSavedJobs)

  useEffect(() => {
    const sync = () => setSaved(readSavedJobs())
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  return saved
}

/** Convenience toggle built on the shared store (keeps components in sync). */
export function useToggleSavedJob(): (id: string) => void {
  return useCallback((id: string) => {
    toggleSavedJob(id)
  }, [])
}
