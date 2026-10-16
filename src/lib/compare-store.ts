import { useCallback, useEffect, useState } from 'react'

/**
 * Job comparison selection (max 3), shared between the Jobs page and the
 * Compare page so a selection made while browsing survives navigation and
 * page reloads.
 */

const STORAGE_KEY = 'careerlens.compare'
export const MAX_COMPARE_JOBS = 3

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const unique: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string' && !unique.includes(entry)) unique.push(entry)
    if (unique.length >= MAX_COMPARE_JOBS) break
  }
  return unique
}

export function readCompareSelection(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function writeCompareSelection(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(ids)))
  } catch {
    // storage may be unavailable
  }
  notify()
}

/** Add/remove a job. Returns false when the add was rejected (limit reached). */
export function toggleCompareJob(id: string): boolean {
  const current = readCompareSelection()
  if (current.includes(id)) {
    writeCompareSelection(current.filter((entry) => entry !== id))
    return true
  }
  if (current.length >= MAX_COMPARE_JOBS) return false
  writeCompareSelection([...current, id])
  return true
}

export function useCompareSelection(): {
  ids: string[]
  remaining: number
  toggle: (id: string) => boolean
  setIds: (ids: string[]) => void
  clear: () => void
} {
  const [ids, setIdsState] = useState<string[]>(readCompareSelection)

  useEffect(() => {
    const sync = () => setIdsState(readCompareSelection())
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  const toggle = useCallback((id: string) => toggleCompareJob(id), [])
  const setIds = useCallback((next: string[]) => writeCompareSelection(next), [])
  const clear = useCallback(() => writeCompareSelection([]), [])

  return { ids, remaining: MAX_COMPARE_JOBS - ids.length, toggle, setIds, clear }
}
